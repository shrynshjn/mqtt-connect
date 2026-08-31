import { getMetaKv } from './kv';

export interface AppPrefs {
  requireFaceIdToOpen: boolean;
  autoLockSeconds: number;
  hidePayloadsInAppSwitcher: boolean;
  messageBufferPerConnection: number;
  // Flat fields, not a nested object — setPrefs() does a shallow merge, so a nested
  // object would get silently clobbered wholesale on any partial patch that doesn't
  // re-send every nested key.
  reviewMilestoneFirstConnectFired: boolean;
  reviewMilestoneFirstSnippetPinFired: boolean;
  reviewProactivePromptCount: number;
  reviewProactiveLastPromptedAt?: number; // epoch ms; absent = never prompted
}

export const DEFAULT_PREFS: AppPrefs = {
  requireFaceIdToOpen: true,
  autoLockSeconds: 120,
  hidePayloadsInAppSwitcher: true,
  messageBufferPerConnection: 5000,
  reviewMilestoneFirstConnectFired: false,
  reviewMilestoneFirstSnippetPinFired: false,
  reviewProactivePromptCount: 0,
};

const KEY = 'prefs';

export function getPrefs(): AppPrefs {
  const raw = getMetaKv().getString(KEY);
  return raw
    ? { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<AppPrefs>) }
    : DEFAULT_PREFS;
}

export function setPrefs(patch: Partial<AppPrefs>): AppPrefs {
  const next = { ...getPrefs(), ...patch };
  getMetaKv().set(KEY, JSON.stringify(next));
  return next;
}
