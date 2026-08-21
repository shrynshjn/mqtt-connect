import { getMetaKv } from '../storage/kv';
import type { ProfileId } from '../types/profile';
import type { TopicUsage, TopicUsageKind } from '../types/topics';

const HALF_LIFE_MS = 7 * 24 * 60 * 60 * 1000;
const PER_PROFILE_CAP = 300;
const GLOBAL_CAP = 800;
const WEIGHTS: Record<TopicUsageKind, number> = {
  subscribe: 1.0,
  publish: 1.0,
  observed: 0.4,
};

function key(profileId: ProfileId): string {
  return `topics:usage:${profileId}`;
}
const GLOBAL_KEY = 'topics:usage:__global__';

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

function record(
  k: string,
  cap: number,
  topic: string,
  kind: TopicUsageKind,
  now: number,
): void {
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
  write(k, entries.slice(0, cap));
}

export function recordTopicUsage(
  profileId: ProfileId,
  topic: string,
  kind: TopicUsageKind,
): void {
  const now = Date.now();
  record(key(profileId), PER_PROFILE_CAP, topic, kind, now);
  record(GLOBAL_KEY, GLOBAL_CAP, topic, kind, now);
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

// Per-profile results first (broker-specific namespaces), global results as a lower-weighted
// top-up, per the plan's scoping decision. Prefix/substring match on the query.
export function suggestTopics(
  profileId: ProfileId,
  query: string,
  limit = 6,
): string[] {
  const now = Date.now();
  const q = query.trim().toLowerCase();
  const local = read(key(profileId)).map(e => ({
    topic: e.topic,
    score: decayedScore(e, now),
  }));
  const global = read(GLOBAL_KEY).map(e => ({
    topic: e.topic,
    score: decayedScore(e, now) * 0.3,
  }));

  const merged = new Map<string, number>();
  for (const { topic, score } of [...local, ...global]) {
    merged.set(topic, Math.max(merged.get(topic) ?? 0, score));
  }

  return Array.from(merged.entries())
    .filter(([topic]) => !q || topic.toLowerCase().includes(q))
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([topic]) => topic);
}
