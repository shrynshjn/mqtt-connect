import type { BrokerId, Transport } from './profile';

export type { BrokerId };

// A broker is the thing that repeats — the same AWS IoT endpoint, the same local
// Mosquitto — while multiple client profiles (different client IDs, different certs
// or credentials) connect to it. Kept as its own record so picking a broker when
// creating a client is a selection, not re-typing host/port/protocol every time.
export interface Broker {
  id: BrokerId;
  name: string;
  host: string;
  port: number;
  transport: Transport;
  // WebSocket URL path (e.g. "/mqtt") — only meaningful for 'ws'/'wss'; defaults to "/"
  // when absent.
  path?: string;
  createdAt: string;
  updatedAt: string;
}
