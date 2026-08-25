import type { IClientOptions } from 'mqtt';
import { getSecret } from '../storage/secretRepo';
import { getBroker } from '../storage/brokerRepo';
import {
  parsePrivateKeyPem,
  emitKeyPemForPlatform,
} from '../crypto/keyNormalize';
import { isTlsTransport, type ConnectionProfile } from '../types/profile';
import type { TcpConnectOptions } from './transport/types';

// Discriminated on which stream mqtt.js should use. 'tcp'/'tls' brokers connect over a
// raw socket this app builds and TLS-wraps itself (react-native-tcp-socket) — the only
// path that supports a pinned CA and client certs. 'ws'/'wss' brokers connect over the
// platform's real WebSocket implementation instead (see connection.ts), which mqtt.js
// drives directly from a URL and needs no socket options of its own.
export type ConnectionInputs =
  | { kind: 'socket'; tcp: TcpConnectOptions; client: IClientOptions }
  | { kind: 'ws'; url: string; client: IClientOptions };

/**
 * Resolves a profile's secret refs (password, CA/cert/key PEMs, key passphrase) out of
 * storage, normalizes the client key encoding for the current platform, and assembles
 * both the transport-level connect options and mqtt.js's client options. Called fresh
 * on every connect attempt rather than cached, so a cert/password change takes effect
 * on the next reconnect without any extra invalidation logic.
 */
export function buildConnectionInputs(
  profile: ConnectionProfile,
): ConnectionInputs {
  const broker = getBroker(profile.brokerId);
  if (!broker) {
    throw new Error(
      "This client's broker could not be found — it may have been deleted. Edit this client and pick a broker again.",
    );
  }

  const client: IClientOptions = {
    clientId: profile.clientId,
    protocolVersion: profile.protocolVersion,
    clean: profile.cleanStart,
    keepalive: profile.keepaliveSeconds,
    connectTimeout: profile.connectTimeoutMs,
    reconnectPeriod: profile.reconnectPeriodMs,
    // A bad password should surface as an auth error, not an infinite reconnect loop.
    reconnectOnConnackError: false,
    username: profile.auth?.username,
    password: profile.auth?.passwordRef
      ? getSecret(profile.auth.passwordRef)
      : undefined,
    will: profile.lastWill
      ? {
          topic: profile.lastWill.topic,
          payload: profile.lastWill.payload,
          qos: profile.lastWill.qos,
          retain: profile.lastWill.retain,
        }
      : undefined,
  };

  if (broker.transport === 'ws' || broker.transport === 'wss') {
    const path = broker.path && broker.path.length > 0 ? broker.path : '/';
    const url = `${broker.transport}://${broker.host}:${broker.port}${path}`;
    return { kind: 'ws', url, client };
  }

  const tcp: TcpConnectOptions = {
    host: broker.host,
    port: broker.port,
    connectTimeoutMs: profile.connectTimeoutMs,
  };

  if (isTlsTransport(broker.transport) && !profile.tls) {
    throw new Error(
      `"${broker.name}" requires TLS but this client has no CA certificate configured — edit the client to add one.`,
    );
  }

  if (isTlsTransport(broker.transport) && profile.tls) {
    const ca = getSecret(profile.tls.caRef);
    if (!ca)
      throw new Error(
        'CA certificate is missing from secure storage for this profile.',
      );

    let cert: string | undefined;
    let key: string | undefined;
    let certAlias: string | undefined;
    let keyAlias: string | undefined;

    if (profile.tls.identity) {
      const certPem = getSecret(profile.tls.identity.certRef);
      const keyPem = getSecret(profile.tls.identity.keyRef);
      if (!certPem || !keyPem)
        throw new Error(
          'Client certificate or key is missing from secure storage for this profile.',
        );

      const passphrase = profile.tls.keyPassphraseRef
        ? getSecret(profile.tls.keyPassphraseRef)
        : undefined;
      const parsed = parsePrivateKeyPem(keyPem, passphrase);

      cert = certPem;
      key = emitKeyPemForPlatform(parsed.forgeKey);
      certAlias = profile.tls.identity.iosCertAlias;
      keyAlias = profile.tls.identity.iosKeyAlias;
    }

    tcp.tls = { ca, cert, key, certAlias, keyAlias };
  }

  return { kind: 'socket', tcp, client };
}
