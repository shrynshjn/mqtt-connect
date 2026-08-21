import type { ProfileId } from './profile';

export type TopicUsageKind = 'subscribe' | 'publish' | 'observed';

export interface TopicUsage {
  topic: string;
  kinds: TopicUsageKind[];
  count: number;
  lastUsedAt: number;
  score: number;
}

export interface SavedSubscription {
  profileId: ProfileId;
  topic: string;
  lastUsedAt: number;
}
