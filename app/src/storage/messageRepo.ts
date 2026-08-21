import { Buffer } from 'buffer';
import { getSecureKv } from './kv';
import type { ProfileId } from '../types/profile';
import type { MqttMessage } from '../types/message';

// Message payloads can carry sensitive telemetry/commands, so — like profiles and
// certs — they live in the encrypted store, not the plain one.
//
// NOTE (pragmatic MVP simplification vs. the plan's SQLCipher/op-sqlite recommendation):
// this persists one JSON blob per connection rather than a real SQLite table, to avoid
// adding a second native-storage dependency (and its own build risk) in the same pass as
// the mTLS transport work. It's correct and simple for the target volumes (thousands of
// rows, not millions) — ManagedConnection is expected to batch writes (e.g. every ~1s or
// every N messages) rather than persisting on every single inbound message, since this
// is an O(n) rewrite. Migrate to op-sqlite/SQLCipher if per-connection volume or query
// needs (pagination, full-text filter) outgrow that.

interface StoredMessage extends Omit<MqttMessage, 'payload'> {
  payloadBase64: string;
}

function key(profileId: ProfileId): string {
  return `messages:${profileId}`;
}

function toStored(m: MqttMessage): StoredMessage {
  const { payload, ...rest } = m;
  return { ...rest, payloadBase64: Buffer.from(payload).toString('base64') };
}

function fromStored(s: StoredMessage): MqttMessage {
  const { payloadBase64, ...rest } = s;
  return { ...rest, payload: new Uint8Array(Buffer.from(payloadBase64, 'base64')) };
}

export function loadMessages(profileId: ProfileId): MqttMessage[] {
  const raw = getSecureKv().getString(key(profileId));
  if (!raw) return [];
  return (JSON.parse(raw) as StoredMessage[]).map(fromStored);
}

// Persists the full current message list for a connection, evicting the oldest entries
// beyond `cap` (the profile's configurable messageLogCap). Returns how many were dropped
// so the caller can surface it in the UI rather than losing data silently.
export function saveMessages(profileId: ProfileId, messages: MqttMessage[], cap: number): { dropped: number } {
  const dropped = Math.max(0, messages.length - cap);
  const kept = dropped > 0 ? messages.slice(messages.length - cap) : messages;
  getSecureKv().set(key(profileId), JSON.stringify(kept.map(toStored)));
  return { dropped };
}

export function clearMessages(profileId: ProfileId): void {
  getSecureKv().remove(key(profileId));
}
