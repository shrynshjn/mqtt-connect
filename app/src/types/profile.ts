export type ProfileId = string;
export type SecretId = string;
export type QoS = 0 | 1 | 2;
export type MqttProtocolVersion = 4 | 5;
export type Transport = 'tcp' | 'tls' | 'ws' | 'wss';
export type PayloadFormat = 'text' | 'json' | 'base64';

export interface CertMeta {
  subjectCn?: string;
  issuerCn?: string;
  notBefore?: string;
  notAfter?: string;
  serialNumber?: string;
  sha256Fingerprint: string;
}

export type KeyAlgorithm = 'RSA' | 'EC';

export interface ClientIdentity {
  certRef: SecretId;
  chainRef?: SecretId;
  keyRef: SecretId;
  keyAlgorithm: KeyAlgorithm;
  keySizeBits?: number;
  certMeta: CertMeta;
  iosCertAlias: string;
  iosKeyAlias: string;
}

export interface TlsConfig {
  caRef: SecretId;
  caMeta: CertMeta;
  identity?: ClientIdentity;
  keyPassphraseRef?: SecretId;
  servername?: string;
}

export interface AuthConfig {
  username?: string;
  passwordRef?: SecretId;
}

export interface LastWill {
  topic: string;
  payload: string;
  qos: QoS;
  retain: boolean;
}

export interface ConnectionProfile {
  id: ProfileId;
  schemaVersion: number;
  name: string;
  sigil: string;

  host: string;
  port: number;
  transport: Transport;
  wsPath?: string;

  clientId: string;
  protocolVersion: MqttProtocolVersion;
  cleanStart: boolean;
  keepaliveSeconds: number;
  connectTimeoutMs: number;
  reconnectPeriodMs: number;

  auth?: AuthConfig;
  tls?: TlsConfig;
  lastWill?: LastWill;

  defaultSubscribeQos: QoS;
  defaultPublishQos: QoS;
  defaultRetain: boolean;
  defaultPayloadFormat: PayloadFormat;

  autoConnectOnLaunch: boolean;

  createdAt: string;
  updatedAt: string;
  lastConnectedAt?: string;
}

export function isTlsTransport(transport: Transport): boolean {
  return transport === 'tls' || transport === 'wss';
}

export function defaultPortFor(transport: Transport): number {
  switch (transport) {
    case 'tcp':
      return 1883;
    case 'tls':
      return 8883;
    case 'ws':
      return 8080;
    case 'wss':
      return 8081;
  }
}
