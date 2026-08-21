import type { ProfileId, QoS } from './profile';

export type ConnectionStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnecting'
  | 'error';

export type ErrorCategory =
  | 'dns'
  | 'tcp'
  | 'tls-handshake'
  | 'tls-client-cert'
  | 'tls-trust'
  | 'mqtt-connack'
  | 'mqtt-auth'
  | 'protocol'
  | 'timeout'
  | 'unknown';

export interface NormalizedError {
  category: ErrorCategory;
  message: string;
  raw?: string;
  hint?: string;
  at: number;
}

export interface SubscriptionRecord {
  id: string;
  filter: string;
  requestedQos: QoS;
  grantedQos?: QoS | 'failure';
  createdAt: number;
  messageCount: number;
  lastMessageAt?: number;
}

export interface ConnectionSnapshot {
  profileId: ProfileId;
  status: ConnectionStatus;
  statusSince: number;
  reconnectAttempt: number;
  lastError?: NormalizedError;
  broker?: {
    sessionPresent: boolean;
    assignedClientId?: string;
  };
  subscriptions: SubscriptionRecord[];
  counters: {
    rx: number;
    tx: number;
    bytesRx: number;
    bytesTx: number;
    droppedFromLog: number;
  };
  connectedSince?: number;
}

export function emptySnapshot(profileId: ProfileId): ConnectionSnapshot {
  return {
    profileId,
    status: 'idle',
    statusSince: Date.now(),
    reconnectAttempt: 0,
    subscriptions: [],
    counters: { rx: 0, tx: 0, bytesRx: 0, bytesTx: 0, droppedFromLog: 0 },
  };
}
