import { create } from 'zustand';
import * as profileRepo from '../storage/profileRepo';
import * as manager from '../mqtt/connectionManager';
import type { ConnectionProfile, ProfileId } from '../types/profile';
import { useConnectionsStore } from './connectionsStore';

interface ProfilesState {
  profiles: ConnectionProfile[];
  load: () => void;
  save: (profile: ConnectionProfile) => void;
  remove: (id: ProfileId) => void;
}

export const useProfilesStore = create<ProfilesState>(set => ({
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
}));
