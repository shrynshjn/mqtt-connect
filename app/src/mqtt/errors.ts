import { Platform } from 'react-native';
import type { ErrorCategory, NormalizedError } from '../types/connection';

const CONNACK_REASONS: Record<number, string> = {
  1: 'Unacceptable protocol version',
  2: 'Identifier rejected',
  3: 'Broker unavailable',
  4: 'Bad username or password',
  5: 'Not authorized',
};

function categorize(raw: string): ErrorCategory {
  const s = raw.toLowerCase();
  if (s.includes('enotfound') || s.includes('dns')) return 'dns';
  if (s.includes('econnrefused') || s.includes('etimedout') || s.includes('network')) return 'tcp';
  if (s.includes('certificate') && (s.includes('client') || s.includes('key'))) return 'tls-client-cert';
  if (s.includes('trust') || s.includes('unable to verify') || s.includes('certificate')) return 'tls-trust';
  if (s.includes('handshake') || s.includes('ssl') || s.includes('tls')) return 'tls-handshake';
  if (s.includes('connack') || s.includes('not authorized') || s.includes('bad username')) return 'mqtt-connack';
  if (s.includes('timeout')) return 'timeout';
  return 'unknown';
}

function hintFor(category: ErrorCategory): string | undefined {
  switch (category) {
    case 'dns':
      return "Couldn't resolve this host — check the broker address.";
    case 'tcp':
      return 'Connection refused or timed out — check the host, port, and that the broker is reachable from this network.';
    case 'tls-client-cert':
      return Platform.OS === 'android'
        ? 'Android needs the client key as unencrypted PKCS#8 — if this key came from a PKCS#1 ("BEGIN RSA PRIVATE KEY") export, re-export it as PKCS#8.'
        : 'iOS needs the client key as PKCS#1 — if this key came from a PKCS#8 ("BEGIN PRIVATE KEY") export, that should have been converted automatically; try re-importing the certificate.';
    case 'tls-trust':
      return "The server's certificate could not be verified against the configured CA — confirm you uploaded the right CA (or the correct intermediate) for this broker.";
    case 'tls-handshake':
      return 'TLS handshake failed before any MQTT data was exchanged — check the port matches the configured protocol (tcp vs tls) and that the broker expects TLS on it.';
    case 'mqtt-connack':
      return 'The broker rejected the connection at the MQTT level — check the CONNACK reason code below.';
    default:
      return undefined;
  }
}

export function normalizeError(raw: unknown, connackReturnCode?: number): NormalizedError {
  const rawMessage = raw instanceof Error ? raw.message : String(raw);
  let category = categorize(rawMessage);
  let message = rawMessage;

  if (connackReturnCode != null && connackReturnCode !== 0) {
    category = 'mqtt-connack';
    message = CONNACK_REASONS[connackReturnCode] ?? `CONNACK rejected (code ${connackReturnCode})`;
  }

  return {
    category,
    message,
    raw: rawMessage,
    hint: hintFor(category),
    at: Date.now(),
  };
}
