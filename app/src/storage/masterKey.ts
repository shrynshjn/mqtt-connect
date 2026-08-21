import * as Keychain from 'react-native-keychain';
import 'react-native-get-random-values';

const SERVICE = 'com.shrynshjn.mqttconnect.masterkey';
const USERNAME = 'mqttconnect';

// MMKV's AES-256 encryption key is used as raw key bytes rather than passed through a
// KDF, so it must serialize to exactly 32 bytes of UTF-8. Masking each random byte into
// the 0-127 range guarantees the JS string round-trips to UTF-8 1:1 (still 224 bits of
// entropy) — the key itself is Keychain-protected, so this is not the app's weak link.
function randomAsciiSafeKey(length: number): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    out += String.fromCharCode(bytes[i] & 0x7f);
  }
  return out;
}

let cached: string | null = null;

export async function getOrCreateMasterKey(): Promise<string> {
  if (cached) return cached;

  const existing = await Keychain.getGenericPassword({ service: SERVICE });
  if (existing && existing.password) {
    cached = existing.password;
    return cached;
  }

  const key = randomAsciiSafeKey(32);
  await Keychain.setGenericPassword(USERNAME, key, {
    service: SERVICE,
    accessible: Keychain.ACCESSIBLE.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  });
  cached = key;
  return cached;
}
