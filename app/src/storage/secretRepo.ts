import 'react-native-get-random-values';
import { getSecureKv } from './kv';
import type { SecretId } from '../types/profile';

export function newSecretId(): SecretId {
  return 'sec_' + Array.from(crypto.getRandomValues(new Uint8Array(12)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export function setSecret(id: SecretId, value: string): void {
  getSecureKv().set(`secret:${id}`, value);
}

export function getSecret(id: SecretId): string | undefined {
  return getSecureKv().getString(`secret:${id}`);
}

export function deleteSecret(id: SecretId): void {
  getSecureKv().remove(`secret:${id}`);
}
