import 'react-native-get-random-values';
import { getSecureKv } from './kv';
import type { Broker, BrokerId } from '../types/broker';

// Brokers carry no secrets of their own (no credentials, no certs — those live on the
// client profiles that reference a broker), but they're kept in the same encrypted
// store as profiles for consistency rather than introducing a second storage tier for
// what's still connection-adjacent data.
const INDEX_KEY = 'broker:index';

function key(id: BrokerId): string {
  return `broker:${id}`;
}

function readIndex(): BrokerId[] {
  const raw = getSecureKv().getString(INDEX_KEY);
  return raw ? (JSON.parse(raw) as BrokerId[]) : [];
}

function writeIndex(ids: BrokerId[]): void {
  getSecureKv().set(INDEX_KEY, JSON.stringify(ids));
}

export function newBrokerId(): BrokerId {
  return 'brk_' + Array.from(crypto.getRandomValues(new Uint8Array(8)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export function listBrokers(): Broker[] {
  return readIndex()
    .map(id => getBroker(id))
    .filter((b): b is Broker => b != null)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function getBroker(id: BrokerId): Broker | undefined {
  const raw = getSecureKv().getString(key(id));
  return raw ? (JSON.parse(raw) as Broker) : undefined;
}

export function saveBroker(broker: Broker): void {
  getSecureKv().set(key(broker.id), JSON.stringify(broker));
  const ids = readIndex();
  if (!ids.includes(broker.id)) writeIndex([...ids, broker.id]);
}

export function deleteBroker(id: BrokerId): void {
  getSecureKv().remove(key(id));
  writeIndex(readIndex().filter(existing => existing !== id));
}
