import { getMetaKv } from '../storage/kv';
import type { ProfileId } from '../types/profile';
import type { TopicUsage, TopicUsageKind } from '../types/topics';

const HALF_LIFE_MS = 7 * 24 * 60 * 60 * 1000;
const PER_PROFILE_CAP = 300;
const WEIGHTS: Record<TopicUsageKind, number> = {
  subscribe: 1.0,
  publish: 1.0,
  observed: 0.4,
};

function key(profileId: ProfileId): string {
  return `topics:usage:${profileId}`;
}

function read(k: string): TopicUsage[] {
  const raw = getMetaKv().getString(k);
  return raw ? (JSON.parse(raw) as TopicUsage[]) : [];
}

function write(k: string, entries: TopicUsage[]): void {
  getMetaKv().set(k, JSON.stringify(entries));
}

function decayedScore(entry: TopicUsage, now: number): number {
  const elapsed = now - entry.lastUsedAt;
  return entry.score * Math.pow(0.5, elapsed / HALF_LIFE_MS);
}

export function recordTopicUsage(
  profileId: ProfileId,
  topic: string,
  kind: TopicUsageKind,
): void {
  const now = Date.now();
  const k = key(profileId);
  const entries = read(k);
  const idx = entries.findIndex(e => e.topic === topic);
  const weight = WEIGHTS[kind];
  if (idx === -1) {
    entries.push({
      topic,
      kinds: [kind],
      count: 1,
      lastUsedAt: now,
      score: weight,
    });
  } else {
    const e = entries[idx];
    e.score = decayedScore(e, now) + weight;
    e.lastUsedAt = now;
    e.count += 1;
    if (!e.kinds.includes(kind)) e.kinds.push(kind);
  }
  entries.sort((a, b) => decayedScore(b, now) - decayedScore(a, now));
  write(k, entries.slice(0, PER_PROFILE_CAP));
}

export function removeTopicUsage(profileId: ProfileId, topic: string): void {
  write(
    key(profileId),
    read(key(profileId)).filter(e => e.topic !== topic),
  );
}

export function clearTopicHistory(profileId: ProfileId): void {
  write(key(profileId), []);
}

// Scoped to this profile only — a topic used on another client shouldn't surface here,
// since different clients often connect to entirely different brokers. Prefix/substring
// match on the query.
export function suggestTopics(
  profileId: ProfileId,
  query: string,
  limit = 6,
): string[] {
  const now = Date.now();
  const q = query.trim().toLowerCase();

  return read(key(profileId))
    .map(e => ({ topic: e.topic, score: decayedScore(e, now) }))
    .filter(({ topic }) => !q || topic.toLowerCase().includes(q))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ topic }) => topic);
}
