import { getMetaKv } from './kv';
import type { ProfileId, QoS } from '../types/profile';

export interface PersistedSubscription {
  topic: string;
  qos: QoS;
}

export interface SavedTopic {
  topic: string;
  lastUsedAt: number;
}

function activeKey(profileId: ProfileId) {
  return `subs:active:${profileId}`;
}
function savedKey(profileId: ProfileId) {
  return `subs:saved:${profileId}`;
}

export function getActiveSubscriptions(profileId: ProfileId): PersistedSubscription[] {
  const raw = getMetaKv().getString(activeKey(profileId));
  return raw ? (JSON.parse(raw) as PersistedSubscription[]) : [];
}

export function setActiveSubscriptions(profileId: ProfileId, subs: PersistedSubscription[]): void {
  getMetaKv().set(activeKey(profileId), JSON.stringify(subs));
}

export function getSavedTopics(profileId: ProfileId): SavedTopic[] {
  const raw = getMetaKv().getString(savedKey(profileId));
  return raw ? (JSON.parse(raw) as SavedTopic[]) : [];
}

export function setSavedTopics(profileId: ProfileId, topics: SavedTopic[]): void {
  getMetaKv().set(savedKey(profileId), JSON.stringify(topics));
}

// Move a topic from active -> saved (Unsub) or saved -> active (Subscribe), per the
// canvas's Topics tab interaction.
export function moveToSaved(profileId: ProfileId, topic: string): void {
  const active = getActiveSubscriptions(profileId).filter(s => s.topic !== topic);
  setActiveSubscriptions(profileId, active);
  const saved = getSavedTopics(profileId).filter(s => s.topic !== topic);
  setSavedTopics(profileId, [{ topic, lastUsedAt: Date.now() }, ...saved]);
}

export function moveToActive(profileId: ProfileId, topic: string, qos: QoS): void {
  const saved = getSavedTopics(profileId).filter(s => s.topic !== topic);
  setSavedTopics(profileId, saved);
  const active = getActiveSubscriptions(profileId).filter(s => s.topic !== topic);
  setActiveSubscriptions(profileId, [...active, { topic, qos }]);
}
