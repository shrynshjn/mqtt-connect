import { ManagedConnection } from './connection';
import { listProfiles, getProfile } from '../storage/profileRepo';
import type { ConnectionProfile, ProfileId, QoS } from '../types/profile';
import type { ConnectionSnapshot } from '../types/connection';
import type { MqttMessage, PublishRequest } from '../types/message';

/** Module-scope singleton — deliberately has zero React imports, so multiple concurrent
 * connections aren't tied to any screen's mount/unmount lifecycle, and the whole module
 * is testable with plain Jest. Zustand stores subscribe to it via onChange/onMessages;
 * they never own connection state themselves. */
const connections = new Map<ProfileId, ManagedConnection>();

function getOrCreate(profileId: ProfileId): ManagedConnection {
  let conn = connections.get(profileId);
  if (!conn) {
    const profile = getProfile(profileId);
    if (!profile) throw new Error(`No such profile: ${profileId}`);
    conn = new ManagedConnection(profile);
    connections.set(profileId, conn);
  }
  return conn;
}

// getOrCreate() reads the profile from storage and constructs a ManagedConnection the
// first time a given profile is touched — if that throws (missing profile, corrupted
// data), it must not do so uncaught: called straight from a button's onPress, an
// uncaught throw here means the tap silently does nothing instead of surfacing a fault.
export function connect(profileId: ProfileId): void {
  try {
    getOrCreate(profileId).connect();
  } catch (err) {
    console.warn(`connect(${profileId}) failed before a connection could even be attempted:`, err);
  }
}

export function disconnect(profileId: ProfileId): void {
  try {
    connections.get(profileId)?.disconnect();
  } catch (err) {
    console.warn(`disconnect(${profileId}) failed:`, err);
  }
}

export function isConnected(profileId: ProfileId): boolean {
  return connections.get(profileId)?.getSnapshot().status === 'connected';
}

export function subscribe(
  profileId: ProfileId,
  filter: string,
  qos: QoS,
): { ok: boolean; error?: string } {
  return getOrCreate(profileId).subscribe(filter, qos);
}

export function unsubscribe(profileId: ProfileId, filter: string): void {
  connections.get(profileId)?.unsubscribe(filter);
}

export function publish(req: PublishRequest): { ok: boolean; error?: string } {
  return getOrCreate(req.profileId).publish(req);
}

export function getSnapshot(
  profileId: ProfileId,
): ConnectionSnapshot | undefined {
  return connections.get(profileId)?.getSnapshot();
}

export function getAllSnapshots(): ConnectionSnapshot[] {
  return listProfiles()
    .map(p => connections.get(p.id)?.getSnapshot())
    .filter((s): s is ConnectionSnapshot => !!s);
}

export function getMessages(profileId: ProfileId): MqttMessage[] {
  return connections.get(profileId)?.getMessages() ?? [];
}

export function clearMessages(profileId: ProfileId): void {
  connections.get(profileId)?.clearMessages();
}

export function onSnapshotChange(
  profileId: ProfileId,
  cb: (s: ConnectionSnapshot) => void,
): () => void {
  return getOrCreate(profileId).onSnapshotChange(cb);
}

export function onMessages(
  profileId: ProfileId,
  cb: (m: MqttMessage[]) => void,
): () => void {
  return getOrCreate(profileId).onMessages(cb);
}

// Profiles are edited independently of whether they're currently connected — keep the
// live ManagedConnection's copy in sync so a reconnect (or resubscribe) picks up the change.
export function notifyProfileUpdated(profile: ConnectionProfile): void {
  connections.get(profile.id)?.updateProfile(profile);
}

export function destroyConnection(profileId: ProfileId): void {
  connections.get(profileId)?.destroy();
  connections.delete(profileId);
}

// On cold start, connect every profile that opted into autoConnectOnLaunch.
export function connectAutoLaunchProfiles(): void {
  listProfiles()
    .filter(p => p.autoConnectOnLaunch)
    .forEach(p => connect(p.id));
}
