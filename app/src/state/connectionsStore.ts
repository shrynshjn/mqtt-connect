import { create } from 'zustand';
import * as manager from '../mqtt/connectionManager';
import type { ProfileId, QoS } from '../types/profile';
import type { ConnectionSnapshot } from '../types/connection';
import type { PublishRequest } from '../types/message';

interface ConnectionsState {
  snapshots: Record<ProfileId, ConnectionSnapshot>;
  // Profiles being actively watched (subscribed to the manager's per-connection change
  // events) — watching is independent of connected/idle, since even an idle profile's
  // card on the Hub needs its snapshot to render.
  watch: (profileId: ProfileId) => void;
  unwatch: (profileId: ProfileId) => void;
  connect: (profileId: ProfileId) => void;
  disconnect: (profileId: ProfileId) => void;
  subscribeTopic: (profileId: ProfileId, filter: string, qos: QoS) => { ok: boolean; error?: string };
  unsubscribeTopic: (profileId: ProfileId, filter: string) => void;
  publish: (req: PublishRequest) => { ok: boolean; error?: string };
}

const unsubscribers = new Map<ProfileId, () => void>();

export const useConnectionsStore = create<ConnectionsState>(set => ({
  snapshots: {},

  watch: profileId => {
    if (unsubscribers.has(profileId)) return;
    const unsub = manager.onSnapshotChange(profileId, snapshot => {
      set(state => ({ snapshots: { ...state.snapshots, [profileId]: snapshot } }));
    });
    unsubscribers.set(profileId, unsub);
    set(state => ({ snapshots: { ...state.snapshots, [profileId]: manager.getSnapshot(profileId)! } }));
  },

  unwatch: profileId => {
    unsubscribers.get(profileId)?.();
    unsubscribers.delete(profileId);
  },

  connect: profileId => manager.connect(profileId),
  disconnect: profileId => manager.disconnect(profileId),
  subscribeTopic: (profileId, filter, qos) => manager.subscribe(profileId, filter, qos),
  unsubscribeTopic: (profileId, filter) => manager.unsubscribe(profileId, filter),
  publish: req => manager.publish(req),
}));

export function selectSnapshot(profileId: ProfileId) {
  return (state: ConnectionsState) => state.snapshots[profileId];
}
