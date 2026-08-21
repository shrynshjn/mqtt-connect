import 'react-native-get-random-values';
import { getMetaKv } from './kv';
import type { ProfileId } from '../types/profile';
import type { Snippet } from '../types/message';

function key(profileId: ProfileId): string {
  return `snippets:${profileId}`;
}

export function getSnippets(profileId: ProfileId): Snippet[] {
  const raw = getMetaKv().getString(key(profileId));
  return raw ? (JSON.parse(raw) as Snippet[]) : [];
}

export function addSnippet(snippet: Omit<Snippet, 'id' | 'createdAt'>): Snippet {
  const full: Snippet = {
    ...snippet,
    id: 'snip_' + Array.from(crypto.getRandomValues(new Uint8Array(6))).map(b => b.toString(16).padStart(2, '0')).join(''),
    createdAt: Date.now(),
  };
  getMetaKv().set(key(snippet.profileId), JSON.stringify([...getSnippets(snippet.profileId), full]));
  return full;
}

export function removeSnippet(profileId: ProfileId, snippetId: string): void {
  getMetaKv().set(key(profileId), JSON.stringify(getSnippets(profileId).filter(s => s.id !== snippetId)));
}
