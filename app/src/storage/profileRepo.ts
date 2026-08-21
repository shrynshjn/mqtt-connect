import 'react-native-get-random-values';
import { getSecureKv } from './kv';
import type { ConnectionProfile, ProfileId } from '../types/profile';
import { deleteSecret } from './secretRepo';

const INDEX_KEY = 'profile:index';
const CURRENT_SCHEMA_VERSION = 1;

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
  return 'prof_' + Array.from(crypto.getRandomValues(new Uint8Array(8)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export function listProfiles(): ConnectionProfile[] {
  return readIndex()
    .map(id => getProfile(id))
    .filter((p): p is ConnectionProfile => p != null);
}

export function getProfile(id: ProfileId): ConnectionProfile | undefined {
  const raw = getSecureKv().getString(key(id));
  return raw ? (JSON.parse(raw) as ConnectionProfile) : undefined;
}

export function saveProfile(profile: ConnectionProfile): void {
  const withVersion: ConnectionProfile = { ...profile, schemaVersion: CURRENT_SCHEMA_VERSION };
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

export function deleteProfile(id: ProfileId): void {
  const profile = getProfile(id);
  if (profile) secretRefsOf(profile).forEach(deleteSecret);
  getSecureKv().remove(key(id));
  writeIndex(readIndex().filter(existing => existing !== id));
}
