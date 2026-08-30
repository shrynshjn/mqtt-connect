import { create } from 'zustand';
import * as profileRepo from '../storage/profileRepo';
import * as manager from '../mqtt/connectionManager';
import { getSecureKv, getMetaKv } from '../storage/kv';
import { getPrefs, setPrefs } from '../storage/prefsRepo';
import type { ConnectionProfile, ProfileId } from '../types/profile';
import { useConnectionsStore } from './connectionsStore';

interface ProfilesState {
  profiles: ConnectionProfile[];
  load: () => void;
  save: (profile: ConnectionProfile) => void;
  remove: (id: ProfileId) => void;
  // Wipes every client, broker, credential, and certificate — everything in the
  // encrypted store, plus subscriptions/snippets/topic history in the plain one — but
  // preserves app preferences (Face ID lock, buffer cap, etc.), since those aren't
  // "client/broker/credential/certificate" data by the erase confirmation's own wording.
  eraseAll: () => void;
}

export const useProfilesStore = create<ProfilesState>((set, get) => ({
  profiles: [],

  load: () => {
    const profiles = profileRepo.listProfiles();
    profiles.forEach(p => useConnectionsStore.getState().watch(p.id));
    set({ profiles });
  },

  save: profile => {
    profileRepo.saveProfile(profile);
    manager.notifyProfileUpdated(profile);
    useConnectionsStore.getState().watch(profile.id);
    set({ profiles: profileRepo.listProfiles() });
  },

  remove: id => {
    manager.disconnect(id);
    manager.destroyConnection(id);
    useConnectionsStore.getState().unwatch(id);
    profileRepo.deleteProfile(id);
    set({ profiles: profileRepo.listProfiles() });
  },

  eraseAll: () => {
    get().profiles.forEach(p => {
      manager.disconnect(p.id);
      manager.destroyConnection(p.id);
      useConnectionsStore.getState().unwatch(p.id);
    });

    const prefs = getPrefs();
    getSecureKv().clearAll();
    getMetaKv().clearAll();
    setPrefs(prefs);

    useConnectionsStore.setState({ snapshots: {} });
    set({ profiles: [] });
  },
}));
