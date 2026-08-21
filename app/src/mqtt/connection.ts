import { Buffer } from 'buffer';
import mqttDefault, {
  type IConnackPacket,
  type IPublishPacket,
  type MqttClient as MqttClientType,
} from 'mqtt';
import type { ConnectionProfile, QoS } from '../types/profile';
import {
  emptySnapshot,
  type ConnectionSnapshot,
  type SubscriptionRecord,
} from '../types/connection';
import type { MqttMessage, PublishRequest } from '../types/message';
import { buildConnectionInputs } from './mqttOptions';
import { makeStreamBuilder } from './transport/streamBuilder';
import { normalizeError } from './errors';
import {
  matchingFilters,
  isValidPublishTopic,
  isValidSubscriptionFilter,
} from './topicMatch';
import { recordTopicUsage } from '../topics/topicSuggestions';
import {
  getActiveSubscriptions,
  moveToActive,
  moveToSaved,
} from '../storage/subscriptionRepo';
import { loadMessages, saveMessages, clearMessages as clearPersistedMessages } from '../storage/messageRepo';
import { getPrefs } from '../storage/prefsRepo';

// mqtt's React Native build (dist/mqtt.esm.js, selected via the package's "react-native"
// export condition) has exactly one static export — `export default` — with MqttClient,
// connect, etc. only reachable as *properties* of that default export at runtime, added
// via a dynamic `__exportStar`, not as real named ES module bindings. A named import
// (`import { MqttClient } from 'mqtt'`) is therefore not statically valid against this
// file and silently resolves to `undefined` — which is exactly what produced the
// "undefined cannot be used as a constructor" crash on the first real device test.
// Reading the property off the default import at runtime is what actually works.
const MqttClient = (
  mqttDefault as unknown as { MqttClient: typeof MqttClientType }
).MqttClient;

const FLUSH_DELAY_MS = 1000;
let idCounter = 0;
function nextMessageId(profileId: string): string {
  idCounter += 1;
  return `${profileId}-${Date.now()}-${idCounter}`;
}

type SnapshotListener = (snapshot: ConnectionSnapshot) => void;
type MessagesListener = (messages: MqttMessage[]) => void;

/** One profile <-> one live mqtt.js client. Owns its own status, subscriptions,
 * message buffer, and persistence — nothing here depends on any screen being mounted. */
export class ManagedConnection {
  private client: MqttClientType | null = null;
  private snapshot: ConnectionSnapshot;
  private messages: MqttMessage[];
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private snapshotListeners = new Set<SnapshotListener>();
  private messagesListeners = new Set<MessagesListener>();

  constructor(private profile: ConnectionProfile) {
    this.snapshot = emptySnapshot(profile.id);
    this.messages = loadMessages(profile.id);
  }

  updateProfile(profile: ConnectionProfile): void {
    this.profile = profile;
  }

  getSnapshot(): ConnectionSnapshot {
    return this.snapshot;
  }

  getMessages(): MqttMessage[] {
    return this.messages;
  }

  // Clears both the in-memory feed and the persisted log immediately — nothing is kept
  // for "undo", matching the ask for an instant clear rather than a soft/reversible one.
  clearMessages(): void {
    this.messages = [];
    this.messagesListeners.forEach(l => l(this.messages));
    clearPersistedMessages(this.profile.id);
    this.setSnapshot({ counters: { ...this.snapshot.counters, rx: 0, tx: 0, bytesRx: 0, bytesTx: 0, droppedFromLog: 0 } });
  }

  onSnapshotChange(cb: SnapshotListener): () => void {
    this.snapshotListeners.add(cb);
    return () => this.snapshotListeners.delete(cb);
  }

  onMessages(cb: MessagesListener): () => void {
    this.messagesListeners.add(cb);
    return () => this.messagesListeners.delete(cb);
  }

  private setSnapshot(patch: Partial<ConnectionSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch };
    this.snapshotListeners.forEach(l => l(this.snapshot));
  }

  connect(): void {
    if (this.client) return;
    this.setSnapshot({
      status: 'connecting',
      statusSince: Date.now(),
      lastError: undefined,
    });

    let inputs: ReturnType<typeof buildConnectionInputs>;
    try {
      inputs = buildConnectionInputs(this.profile);
    } catch (err) {
      this.setSnapshot({
        status: 'error',
        statusSince: Date.now(),
        lastError: normalizeError(err),
      });
      return;
    }

    // mqtt.js's public StreamBuilder type requires a full Node `Duplex` — our adapter
    // deliberately implements only the subset MqttClient actually calls at runtime
    // (verified against the compiled client.js; see rnTcpDuplex.ts), so this narrows
    // structurally-incompatible-but-runtime-correct types at the one call site.
    //
    // This construction call synchronously invokes the streamBuilder, which reaches into
    // the native TLS socket module — any synchronous throw here (malformed native args,
    // a native module issue) must not escape uncaught: in a release build there is no
    // red-screen safety net, so an uncaught JS exception here is a hard app crash, not
    // just a dev-mode warning.
    let client: MqttClientType;
    try {
      client = new MqttClient(
        makeStreamBuilder(inputs.tcp) as unknown as ConstructorParameters<
          typeof MqttClient
        >[0],
        inputs.client,
      );
    } catch (err) {
      this.setSnapshot({
        status: 'error',
        statusSince: Date.now(),
        lastError: normalizeError(err),
      });
      return;
    }
    this.client = client;

    client.on('connect', (connack: IConnackPacket) => {
      this.setSnapshot({
        status: 'connected',
        statusSince: Date.now(),
        connectedSince: Date.now(),
        reconnectAttempt: 0,
        lastError: undefined,
        broker: {
          sessionPresent: !!connack.sessionPresent,
          assignedClientId: this.profile.clientId,
        },
      });
      this.resubscribeAll();
    });

    client.on('reconnect', () => {
      this.setSnapshot({
        status: 'reconnecting',
        statusSince: Date.now(),
        reconnectAttempt: this.snapshot.reconnectAttempt + 1,
      });
    });

    client.on('close', () => {
      if (this.snapshot.status === 'disconnecting') return;
      if (this.snapshot.status === 'error') {
        // mqtt.js's own reconnect loop is done retrying (or was never started) by the
        // time 'close' fires after an error — clear the client so a later tap of
        // Connect/Retry doesn't hit the `if (this.client) return` guard and silently
        // no-op forever.
        this.client = null;
        return;
      }
      const next = this.profile.reconnectPeriodMs > 0 ? 'reconnecting' : 'idle';
      this.setSnapshot({ status: next, statusSince: Date.now() });
    });

    client.on('error', err => {
      this.setSnapshot({
        status: 'error',
        statusSince: Date.now(),
        lastError: normalizeError(err),
      });
      // Same reasoning as above: without this, a failed connect leaves `this.client`
      // set forever, and every future Connect/Retry tap becomes a no-op.
      this.client?.end(true);
      this.client = null;
    });

    client.on(
      'message',
      (topic: string, payload: Buffer, packet: IPublishPacket) => {
        this.handleIncoming(topic, payload, packet);
      },
    );
  }

  disconnect(): void {
    this.setSnapshot({ status: 'disconnecting', statusSince: Date.now() });
    this.client?.end(true);
    this.client = null;
    this.setSnapshot({ status: 'idle', statusSince: Date.now() });
  }

  destroy(): void {
    this.client?.end(true);
    this.client = null;
    this.snapshotListeners.clear();
    this.messagesListeners.clear();
  }

  private resubscribeAll(): void {
    getActiveSubscriptions(this.profile.id).forEach(s =>
      this.subscribe(s.topic, s.qos, { persist: false }),
    );
  }

  // Neither subscribe() nor publish() throw — both are called directly from UI taps,
  // and an uncaught throw there is a hard crash in a release build (no red-screen net).
  // Failures come back as a result object instead, for the caller to show as a toast.
  subscribe(
    filter: string,
    qos: QoS,
    opts: { persist?: boolean } = {},
  ): { ok: boolean; error?: string } {
    if (!this.client) return { ok: false, error: 'not connected' };
    if (!isValidSubscriptionFilter(filter))
      return {
        ok: false,
        error: `"${filter}" is not a valid subscription filter`,
      };

    try {
      this.client.subscribe(filter, { qos }, (err, granted) => {
        const record: SubscriptionRecord = {
          id: filter,
          filter,
          requestedQos: qos,
          grantedQos: err ? 'failure' : (granted?.[0]?.qos as QoS | undefined),
          createdAt: Date.now(),
          messageCount:
            this.snapshot.subscriptions.find(s => s.filter === filter)
              ?.messageCount ?? 0,
        };
        this.setSnapshot({
          subscriptions: [
            ...this.snapshot.subscriptions.filter(s => s.filter !== filter),
            record,
          ],
        });
      });
    } catch (err) {
      return { ok: false, error: normalizeError(err).message };
    }

    if (opts.persist !== false) {
      moveToActive(this.profile.id, filter, qos);
      recordTopicUsage(this.profile.id, filter, 'subscribe');
    }
    return { ok: true };
  }

  unsubscribe(filter: string): void {
    try {
      this.client?.unsubscribe(filter);
    } catch {
      // best-effort — local subscription state below is what the UI actually reflects
    }
    this.setSnapshot({
      subscriptions: this.snapshot.subscriptions.filter(
        s => s.filter !== filter,
      ),
    });
    moveToSaved(this.profile.id, filter);
  }

  publish(req: Omit<PublishRequest, 'profileId'>): {
    ok: boolean;
    error?: string;
  } {
    if (!this.client) return { ok: false, error: 'not connected' };
    if (!isValidPublishTopic(req.topic))
      return {
        ok: false,
        error: `"${req.topic}" is not a valid publish topic (wildcards aren't allowed)`,
      };

    const payloadBuf = Buffer.from(req.payload, 'utf8');
    try {
      this.client.publish(
        req.topic,
        payloadBuf,
        { qos: req.qos, retain: req.retain },
        err => {
          if (err) this.setSnapshot({ lastError: normalizeError(err) });
        },
      );
    } catch (err) {
      return { ok: false, error: normalizeError(err).message };
    }

    recordTopicUsage(this.profile.id, req.topic, 'publish');
    this.appendMessage({
      direction: 'out',
      topic: req.topic,
      payload: new Uint8Array(payloadBuf),
      qos: req.qos,
      retain: req.retain,
    });
    this.bumpCounters({ tx: 1, bytesTx: payloadBuf.length });
    return { ok: true };
  }

  private handleIncoming(
    topic: string,
    payload: Buffer,
    packet: IPublishPacket,
  ): void {
    recordTopicUsage(this.profile.id, topic, 'observed');

    const matched = matchingFilters(
      topic,
      this.snapshot.subscriptions.map(s => s.filter),
    );
    if (matched.length > 0) {
      const now = Date.now();
      this.setSnapshot({
        subscriptions: this.snapshot.subscriptions.map(s =>
          matched.includes(s.filter)
            ? { ...s, messageCount: s.messageCount + 1, lastMessageAt: now }
            : s,
        ),
      });
    }

    this.appendMessage({
      direction: 'in',
      topic,
      payload: new Uint8Array(payload),
      qos: (packet.qos ?? 0) as QoS,
      retain: !!packet.retain,
      dup: !!packet.dup,
    });
    this.bumpCounters({ rx: 1, bytesRx: payload.length });
  }

  private bumpCounters(delta: Partial<ConnectionSnapshot['counters']>): void {
    const c = this.snapshot.counters;
    this.setSnapshot({
      counters: {
        rx: c.rx + (delta.rx ?? 0),
        tx: c.tx + (delta.tx ?? 0),
        bytesRx: c.bytesRx + (delta.bytesRx ?? 0),
        bytesTx: c.bytesTx + (delta.bytesTx ?? 0),
        droppedFromLog: c.droppedFromLog,
      },
    });
  }

  private appendMessage(
    partial: Omit<MqttMessage, 'id' | 'profileId' | 'receivedAt' | 'size'>,
  ): void {
    const message: MqttMessage = {
      id: nextMessageId(this.profile.id),
      profileId: this.profile.id,
      receivedAt: Date.now(),
      size: partial.payload.length,
      ...partial,
    };
    // A new array reference, not push() — the listener feeds straight into React's
    // useState setter (see useMessages.ts), and React bails out of re-rendering when
    // the "new" state is the exact same object reference as before (mutating in place
    // and re-passing it is indistinguishable from passing back the old value). That was
    // the actual cause of "count increases but the list doesn't update".
    this.messages = [...this.messages, message];
    this.messagesListeners.forEach(l => l(this.messages));
    this.scheduleFlush();
  }

  // Batches the persisted write rather than doing it on every single message — a
  // chatty topic would otherwise rewrite the whole per-connection blob at message rate.
  private scheduleFlush(): void {
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      const { dropped } = saveMessages(
        this.profile.id,
        this.messages,
        getPrefs().messageBufferPerConnection,
      );
      if (dropped > 0) {
        this.messages = this.messages.slice(dropped);
        this.messagesListeners.forEach(l => l(this.messages));
        this.setSnapshot({
          counters: {
            ...this.snapshot.counters,
            droppedFromLog: this.snapshot.counters.droppedFromLog + dropped,
          },
        });
      }
    }, FLUSH_DELAY_MS);
  }
}
