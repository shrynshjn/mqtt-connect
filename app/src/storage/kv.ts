import { createMMKV, type MMKV } from 'react-native-mmkv';
import { getOrCreateMasterKey } from './masterKey';

let secureKv: MMKV | null = null;
let metaKv: MMKV | null = null;
let initPromise: Promise<void> | null = null;

// Must be awaited once at app startup (before any repo is used) — the encrypted
// instance can't be created until the Keychain-held master key is available.
export function initStorage(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      const key = await getOrCreateMasterKey();
      secureKv = createMMKV({ id: 'mqttconnect.secure', encryptionKey: key, encryptionType: 'AES-256' });
      metaKv = createMMKV({ id: 'mqttconnect.meta' });
    })();
  }
  return initPromise;
}

function require<T>(kv: T | null, name: string): T {
  if (!kv) throw new Error(`storage: ${name} accessed before initStorage() completed`);
  return kv;
}

// Profiles, passwords, and certificate/key PEM blobs — always encrypted at rest.
export function getSecureKv(): MMKV {
  return require(secureKv, 'secureKv');
}

// Topic history, saved subscriptions, prefs, snippets — non-secret.
export function getMetaKv(): MMKV {
  return require(metaKv, 'metaKv');
}
