import 'react-native-get-random-values';
import type { ConnectionProfile, Transport } from '../../types/profile';
import { listBrokers, newBrokerId, saveBroker } from '../../storage/brokerRepo';
import { listProfiles, newProfileId } from '../../storage/profileRepo';
import { newSecretId, setSecret } from '../../storage/secretRepo';
import {
  getActiveSubscriptions,
  moveToActive,
} from '../../storage/subscriptionRepo';
import { certMetaFromPem } from '../../crypto/certInfo';
import { useProfilesStore } from '../../state/profilesStore';
import { useConnectionsStore } from '../../state/connectionsStore';

// HiveMQ's public test broker (https://www.hivemq.com/mqtt/public-mqtt-broker/) — a
// shared, unauthenticated broker anyone can publish/subscribe to. Used only for this
// one-tap "try it live" demo, never as a real production default.
const HIVEMQ_HOST = 'broker.hivemq.com';
const WS_PATH = '/mqtt';

// Filled in once a verified copy of the certificate chain broker.hivemq.com:8883
// presents is available. Left null until then — this app pins TLS connections to
// exactly the CA configured on the profile (see transport/types.ts), so guessing wrong
// here would be worse than not shipping it: it'd fail closed with a confusing trust
// error instead of just asking the user for it once, up front.
export const HIVEMQ_TLS_CA_PEM: string | null = null;

export interface DemoVariant {
  transport: Transport;
  scheme: string;
  label: string;
  port: number;
  path?: string;
  requiresCa: boolean;
}

export const DEMO_VARIANTS: DemoVariant[] = [
  {
    transport: 'tcp',
    scheme: 'mqtt',
    label: 'MQTT',
    port: 1883,
    requiresCa: false,
  },
  {
    transport: 'tls',
    scheme: 'mqtts',
    label: 'MQTT over TLS',
    port: 8883,
    requiresCa: true,
  },
  {
    transport: 'ws',
    scheme: 'ws',
    label: 'WebSocket',
    port: 8000,
    path: WS_PATH,
    requiresCa: false,
  },
  {
    transport: 'wss',
    scheme: 'wss',
    label: 'WebSocket over TLS',
    port: 8884,
    path: WS_PATH,
    requiresCa: false,
  },
];

function demoName(variant: DemoVariant): string {
  return `HiveMQ demo · ${variant.scheme}`;
}

function randomHex(bytes: number): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(bytes)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export interface QuickStartPlan {
  variant: DemoVariant;
  reusingClient: boolean;
  brokerName: string;
  host: string;
  port: number;
  path?: string;
  clientId: string;
  topic: string;
  // Set only when this plan will create a brand-new broker record (vs. reusing one
  // already saved from an earlier tap) — shown in the confirmation screen so a repeat
  // tap doesn't claim it's about to add a second broker it's actually just reusing.
  reusingBroker: boolean;
}

/** Pure — computes exactly what a tap on `variant` would set up, without writing
 * anything, so the confirmation screen can show the user the real values (including a
 * previously-created demo client's actual client ID and topic, if this variant was
 * already set up once) before anything happens. */
export function buildQuickStartPlan(variant: DemoVariant): QuickStartPlan {
  const name = demoName(variant);
  const existingBroker = listBrokers().find(
    b =>
      b.host === HIVEMQ_HOST &&
      b.transport === variant.transport &&
      b.port === variant.port,
  );
  const existingProfile = existingBroker
    ? listProfiles().find(p => p.brokerId === existingBroker.id)
    : undefined;

  if (existingProfile) {
    const [existingSub] = getActiveSubscriptions(existingProfile.id);
    return {
      variant,
      reusingClient: true,
      reusingBroker: true,
      brokerName: name,
      host: HIVEMQ_HOST,
      port: variant.port,
      path: variant.path,
      clientId: existingProfile.clientId,
      topic: existingSub?.topic ?? `mqtt-connect/demo/${randomHex(4)}`,
    };
  }

  return {
    variant,
    reusingClient: false,
    reusingBroker: !!existingBroker,
    brokerName: name,
    host: HIVEMQ_HOST,
    port: variant.port,
    path: variant.path,
    clientId: `mqtt-connect-demo-${randomHex(4)}`,
    topic: `mqtt-connect/demo/${randomHex(4)}`,
  };
}

/** Executes a previously-built plan: creates (or reuses) the broker and client profile,
 * persists the topic subscription so it's picked up automatically on connect, and
 * starts connecting. `caPem` is required and used only for the 'tls' variant when
 * `HIVEMQ_TLS_CA_PEM` hasn't been filled in — see that constant's comment. */
export function commitQuickStartPlan(
  plan: QuickStartPlan,
  caPem?: string,
): { profileId: string } {
  const now = new Date().toISOString();

  let broker = listBrokers().find(
    b =>
      b.host === plan.host &&
      b.transport === plan.variant.transport &&
      b.port === plan.port,
  );
  if (!broker) {
    broker = {
      id: newBrokerId(),
      name: plan.brokerName,
      host: plan.host,
      port: plan.port,
      transport: plan.variant.transport,
      path: plan.path,
      createdAt: now,
      updatedAt: now,
    };
    saveBroker(broker);
  }

  let profile = listProfiles().find(p => p.brokerId === broker!.id);
  if (!profile) {
    let tls: ConnectionProfile['tls'];
    if (plan.variant.requiresCa) {
      const pem = HIVEMQ_TLS_CA_PEM ?? caPem;
      if (!pem) {
        throw new Error(
          'A CA certificate is required for this connection but none was provided.',
        );
      }
      const caRef = newSecretId();
      setSecret(caRef, pem);
      tls = { caRef, caMeta: certMetaFromPem(pem) };
    }

    profile = {
      id: newProfileId(),
      schemaVersion: 2,
      name: plan.brokerName,
      sigil: 'HQ',
      brokerId: broker.id,
      clientId: plan.clientId,
      protocolVersion: 5,
      cleanStart: true,
      keepaliveSeconds: 60,
      connectTimeoutMs: 20000,
      reconnectPeriodMs: 3000,
      tls,
      defaultSubscribeQos: 0,
      defaultPublishQos: 0,
      defaultRetain: false,
      defaultPayloadFormat: 'text',
      autoConnectOnLaunch: false,
      createdAt: now,
      updatedAt: now,
    };
    useProfilesStore.getState().save(profile);
  }

  moveToActive(profile.id, plan.topic, 0);
  useConnectionsStore.getState().connect(profile.id);

  return { profileId: profile.id };
}
