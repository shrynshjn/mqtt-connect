import 'react-native-get-random-values';
import { getSecureKv } from './kv';
import type { ConnectionProfile, ProfileId, Transport } from '../types/profile';
import { deleteSecret } from './secretRepo';
import { listBrokers, newBrokerId, saveBroker } from './brokerRepo';

const INDEX_KEY = 'profile:index';
// Bumped for the broker/client split: profiles used to carry host/port/transport
// directly; that data now lives on a separate Broker record they reference instead.
const CURRENT_SCHEMA_VERSION = 2;

// Pre-v2 profiles carried the broker's connection details inline. Detected by shape
// (not just schemaVersion) so a profile that was somehow written with a stale version
// number still gets migrated rather than silently breaking on the missing brokerId.
interface LegacyProfileShape {
  host?: string;
  port?: number;
  transport?: Transport;
}

function migrateProfile(
  raw: ConnectionProfile & LegacyProfileShape,
): ConnectionProfile {
  if (raw.brokerId || !raw.host) return raw;

  const existing = listBrokers().find(
    b =>
      b.host === raw.host &&
      b.port === raw.port &&
      b.transport === raw.transport,
  );
  const brokerId = existing?.id ?? newBrokerId();
  if (!existing) {
    const now = new Date().toISOString();
    saveBroker({
      id: brokerId,
      name: raw.host!,
      host: raw.host!,
      port: raw.port!,
      transport: raw.transport!,
      createdAt: now,
      updatedAt: now,
    });
  }

  const migrated = { ...raw, brokerId } as ConnectionProfile &
    LegacyProfileShape;
  delete migrated.host;
  delete migrated.port;
  delete migrated.transport;
  saveProfile(migrated);
  return migrated;
}

function key(id: ProfileId): string {
  return `profile:${id}`;
}

function readIndex(): ProfileId[] {
  const raw = getSecureKv().getString(INDEX_KEY);
  return raw ? (JSON.parse(raw) as ProfileId[]) : [];
}

function writeIndex(ids: ProfileId[]): void {
  getSecureKv().set(INDEX_KEY, JSON.stringify(ids));
}

export function newProfileId(): ProfileId {
  return (
    'prof_' +
    Array.from(crypto.getRandomValues(new Uint8Array(8)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
  );
}

export function listProfiles(): ConnectionProfile[] {
  return readIndex()
    .map(id => getProfile(id))
    .filter((p): p is ConnectionProfile => p != null);
}

export function getProfile(id: ProfileId): ConnectionProfile | undefined {
  const raw = getSecureKv().getString(key(id));
  if (!raw) return undefined;
  return migrateProfile(
    JSON.parse(raw) as ConnectionProfile & LegacyProfileShape,
  );
}

export function saveProfile(profile: ConnectionProfile): void {
  const withVersion: ConnectionProfile = {
    ...profile,
    schemaVersion: CURRENT_SCHEMA_VERSION,
  };
  getSecureKv().set(key(profile.id), JSON.stringify(withVersion));
  const ids = readIndex();
  if (!ids.includes(profile.id)) writeIndex([...ids, profile.id]);
}

function secretRefsOf(profile: ConnectionProfile): string[] {
  const refs: (string | undefined)[] = [
    profile.auth?.passwordRef,
    profile.tls?.caRef,
    profile.tls?.keyPassphraseRef,
    profile.tls?.identity?.certRef,
    profile.tls?.identity?.chainRef,
    profile.tls?.identity?.keyRef,
  ];
  return refs.filter((r): r is string => !!r);
}

export function clientsUsingBroker(brokerId: string): ConnectionProfile[] {
  return listProfiles().filter(p => p.brokerId === brokerId);
}

export function deleteProfile(id: ProfileId): void {
  const profile = getProfile(id);
  if (profile) secretRefsOf(profile).forEach(deleteSecret);
  getSecureKv().remove(key(id));
  writeIndex(readIndex().filter(existing => existing !== id));
}
