import type { ProfileId, QoS } from './profile';

export type MessageDirection = 'in' | 'out';

export interface MqttMessage {
  id: string;
  profileId: ProfileId;
  direction: MessageDirection;
  topic: string;
  payload: Uint8Array;
  size: number;
  qos: QoS;
  retain: boolean;
  dup?: boolean;
  receivedAt: number;
}

export interface PublishRequest {
  profileId: ProfileId;
  topic: string;
  payload: string;
  qos: QoS;
  retain: boolean;
}

export interface Snippet {
  id: string;
  profileId: ProfileId;
  name: string;
  topic: string;
  payload: string;
  qos: QoS;
  retain: boolean;
  createdAt: number;
}
