import 'react-native-get-random-values';
import type { ConnectionProfile, Transport } from '../../types/profile';
import { listBrokers, newBrokerId, saveBroker } from '../../storage/brokerRepo';
import { listProfiles, newProfileId } from '../../storage/profileRepo';
import { newSecretId, setSecret } from '../../storage/secretRepo';
import {
  getActiveSubscriptions,
  moveToActive,
} from '../../storage/subscriptionRepo';
import { certMetaFromPem, daysUntilExpiry } from '../../crypto/certInfo';
import {
  MOSQUITTO_CA_PEM,
  MOSQUITTO_HOST,
  MOSQUITTO_MTLS_PORT,
  issueMosquittoEccIdentity,
} from './mosquittoEcc';
import { useProfilesStore } from '../../state/profilesStore';
import { useConnectionsStore } from '../../state/connectionsStore';

// HiveMQ's public test broker (https://www.hivemq.com/mqtt/public-mqtt-broker/) — a
// shared, unauthenticated broker anyone can publish/subscribe to. Used only for this
// one-tap "try it live" demo, never as a real production default.
const HIVEMQ_HOST = 'broker.hivemq.com';
const WS_PATH = '/mqtt';

// Amazon Root CA 1 — broker.hivemq.com:8883's certificate now chains to this (via
// intermediate "Amazon RSA 2048 M04"), confirmed 2026-08-25 with
// `openssl s_client -connect broker.hivemq.com:8883`; it used to chain to Let's Encrypt's
// ISRG Root X1, which is presumably why HiveMQ once issued through Let's Encrypt and later
// moved TLS termination behind AWS. This app pins raw-TLS connections to exactly the CA
// configured on the profile (see transport/types.ts) rather than the device's trust store,
// so the mqtts demo variant needs this anchor bundled in to be a genuine one-tap button —
// and needs updating again if HiveMQ's cert chain moves once more.
export const HIVEMQ_TLS_CA_PEM: string | null = `-----BEGIN CERTIFICATE-----
MIIDQTCCAimgAwIBAgITBmyfz5m/jAo54vB4ikPmljZbyjANBgkqhkiG9w0BAQsF
ADA5MQswCQYDVQQGEwJVUzEPMA0GA1UEChMGQW1hem9uMRkwFwYDVQQDExBBbWF6
b24gUm9vdCBDQSAxMB4XDTE1MDUyNjAwMDAwMFoXDTM4MDExNzAwMDAwMFowOTEL
MAkGA1UEBhMCVVMxDzANBgNVBAoTBkFtYXpvbjEZMBcGA1UEAxMQQW1hem9uIFJv
b3QgQ0EgMTCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBALJ4gHHKeNXj
ca9HgFB0fW7Y14h29Jlo91ghYPl0hAEvrAIthtOgQ3pOsqTQNroBvo3bSMgHFzZM
9O6II8c+6zf1tRn4SWiw3te5djgdYZ6k/oI2peVKVuRF4fn9tBb6dNqcmzU5L/qw
IFAGbHrQgLKm+a/sRxmPUDgH3KKHOVj4utWp+UhnMJbulHheb4mjUcAwhmahRWa6
VOujw5H5SNz/0egwLX0tdHA114gk957EWW67c4cX8jJGKLhD+rcdqsq08p8kDi1L
93FcXmn/6pUCyziKrlA4b9v7LWIbxcceVOF34GfID5yHI9Y/QCB/IIDEgEw+OyQm
jgSubJrIqg0CAwEAAaNCMEAwDwYDVR0TAQH/BAUwAwEB/zAOBgNVHQ8BAf8EBAMC
AYYwHQYDVR0OBBYEFIQYzIU07LwMlJQuCFmcx7IQTgoIMA0GCSqGSIb3DQEBCwUA
A4IBAQCY8jdaQZChGsV2USggNiMOruYou6r4lK5IpDB/G/wkjUu0yKGX9rbxenDI
U5PMCCjjmCXPI6T53iHTfIUJrU6adTrCC2qJeHZERxhlbI1Bjjt/msv0tadQ1wUs
N+gDS63pYaACbvXy8MWy7Vu33PqUXHeeE6V/Uq2V8viTO96LXFvKWlJbYK8U90vv
o/ufQJVtMVT8QtPHRh8jrdkPSHCa2XV4cdFyQzR1bldZwgJcJmApzyMZFo6IQ6XU
5MsI+yMRQ+hDKXJioaldXgjUkK642M4UwtBV8ob2xJNDd2ZhwLnoQdeXeGADbkpy
rqXRfboQnoZsG4q5WTP468SQvvG5
-----END CERTIFICATE-----
`;

export interface DemoVariant {
  id: 'mqtt' | 'mqtts' | 'ws' | 'wss' | 'ecc';
  transport: Transport;
  scheme: string;
  /** Text on the one-tap chip. */
  chip: string;
  label: string;
  /** Short broker name for titles and copy, e.g. "HiveMQ". */
  brokerLabel: string;
  host: string;
  port: number;
  path?: string;
  requiresCa: boolean;
  /** CA to pin for 'tls' variants; null means the user is asked to paste one. */
  caPem?: string | null;
  /** 'ecc': generate an EC P-256 key on the device and have test.mosquitto.org's
   * public signer issue a client certificate for it (mutual TLS). */
  clientCert?: 'ecc';
}

export const DEMO_VARIANTS: DemoVariant[] = [
  {
    id: 'mqtt',
    transport: 'tcp',
    scheme: 'mqtt',
    chip: 'mqtt',
    label: 'MQTT',
    brokerLabel: 'HiveMQ',
    host: HIVEMQ_HOST,
    port: 1883,
    requiresCa: false,
  },
  {
    id: 'mqtts',
    transport: 'tls',
    scheme: 'mqtts',
    chip: 'mqtts',
    label: 'MQTT over TLS',
    brokerLabel: 'HiveMQ',
    host: HIVEMQ_HOST,
    port: 8883,
    requiresCa: true,
    caPem: HIVEMQ_TLS_CA_PEM,
  },
  {
    id: 'ws',
    transport: 'ws',
    scheme: 'ws',
    chip: 'ws',
    label: 'WebSocket',
    brokerLabel: 'HiveMQ',
    host: HIVEMQ_HOST,
    port: 8000,
    path: WS_PATH,
    requiresCa: false,
  },
  {
    id: 'wss',
    transport: 'wss',
    scheme: 'wss',
    chip: 'wss',
    label: 'WebSocket over TLS',
    brokerLabel: 'HiveMQ',
    host: HIVEMQ_HOST,
    port: 8884,
    path: WS_PATH,
    requiresCa: false,
  },
  {
    id: 'ecc',
    transport: 'tls',
    scheme: 'mqtts',
    chip: 'ecc',
    label: 'Mutual TLS with an EC client certificate',
    brokerLabel: 'Mosquitto',
    host: MOSQUITTO_HOST,
    port: MOSQUITTO_MTLS_PORT,
    requiresCa: true,
    caPem: MOSQUITTO_CA_PEM,
    clientCert: 'ecc',
  },
];

// Re-request the demo certificate when it has this little validity left, so a tap
// doesn't set up a client that stops connecting a day later.
const CERT_RENEW_DAYS = 2;

function demoName(variant: DemoVariant): string {
  return `${variant.brokerLabel} demo · ${
    variant.clientCert ? 'mtls-ecc' : variant.scheme
  }`;
}

function randomHex(bytes: number): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(bytes)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function findDemoBroker(variant: DemoVariant) {
  return listBrokers().find(
    b =>
      b.host === variant.host &&
      b.transport === variant.transport &&
      b.port === variant.port,
  );
}

export interface QuickStartPlan {
  variant: DemoVariant;
  reusingClient: boolean;
  brokerName: string;
  host: string;
  port: number;
  path?: string;
  clientId: string;
  topic: string;
  // Set only when this plan will create a brand-new broker record (vs. reusing one
  // already saved from an earlier tap) — shown in the confirmation screen so a repeat
  // tap doesn't claim it's about to add a second broker it's actually just reusing.
  reusingBroker: boolean;
  /** A client certificate will be requested (first tap, or the old one is expiring). */
  needsCertificate: boolean;
}

function identityNeedsRenewal(profile?: ConnectionProfile): boolean {
  const notAfter = profile?.tls?.identity?.certMeta.notAfter;
  return !notAfter || daysUntilExpiry(notAfter) <= CERT_RENEW_DAYS;
}

/** Pure — computes exactly what a tap on `variant` would set up, without writing
 * anything, so the confirmation screen can show the user the real values (including a
 * previously-created demo client's actual client ID and topic, if this variant was
 * already set up once) before anything happens. */
export function buildQuickStartPlan(variant: DemoVariant): QuickStartPlan {
  const name = demoName(variant);
  const existingBroker = findDemoBroker(variant);
  const existingProfile = existingBroker
    ? listProfiles().find(p => p.brokerId === existingBroker.id)
    : undefined;
  const needsCertificate =
    !!variant.clientCert && identityNeedsRenewal(existingProfile);

  if (existingProfile) {
    const [existingSub] = getActiveSubscriptions(existingProfile.id);
    return {
      variant,
      reusingClient: true,
      reusingBroker: true,
      brokerName: name,
      host: variant.host,
      port: variant.port,
      path: variant.path,
      clientId: existingProfile.clientId,
      topic: existingSub?.topic ?? `mqtt-connect/demo/${randomHex(4)}`,
      needsCertificate,
    };
  }

  return {
    variant,
    reusingClient: false,
    reusingBroker: !!existingBroker,
    brokerName: name,
    host: variant.host,
    port: variant.port,
    path: variant.path,
    clientId: `mqtt-connect-demo-${randomHex(4)}`,
    topic: `mqtt-connect/demo/${randomHex(4)}`,
    needsCertificate,
  };
}

/** Executes a previously-built plan: creates (or reuses) the broker and client profile,
 * requests a client certificate first for the ECC variant (network call), persists the
 * topic subscription so it's picked up automatically on connect, and starts connecting.
 * `caPem` is used only for a 'tls' variant whose `caPem` hasn't been filled in. */
export async function commitQuickStartPlan(
  plan: QuickStartPlan,
  caPem?: string,
): Promise<{ profileId: string }> {
  const { variant } = plan;

  // Network first, so a signer failure leaves nothing half-created behind.
  const issued =
    variant.clientCert && plan.needsCertificate
      ? await issueMosquittoEccIdentity(plan.clientId)
      : undefined;

  const now = new Date().toISOString();

  let broker = findDemoBroker(variant);
  if (!broker) {
    broker = {
      id: newBrokerId(),
      name: plan.brokerName,
      host: plan.host,
      port: plan.port,
      transport: variant.transport,
      path: plan.path,
      createdAt: now,
      updatedAt: now,
    };
    saveBroker(broker);
  }

  let profile = listProfiles().find(p => p.brokerId === broker!.id);
  if (!profile) {
    let tls: ConnectionProfile['tls'];
    if (variant.requiresCa) {
      const pem = variant.caPem ?? caPem;
      if (!pem) {
        throw new Error(
          'A CA certificate is required for this connection but none was provided.',
        );
      }
      const caRef = newSecretId();
      setSecret(caRef, pem);
      tls = { caRef, caMeta: certMetaFromPem(pem) };
    }

    const id = newProfileId();
    profile = {
      id,
      schemaVersion: 2,
      name: plan.brokerName,
      sigil: variant.clientCert ? 'MQ' : 'HQ',
      brokerId: broker.id,
      clientId: plan.clientId,
      protocolVersion: 5,
      cleanStart: true,
      keepaliveSeconds: 60,
      connectTimeoutMs: 20000,
      reconnectPeriodMs: 3000,
      tls,
      defaultSubscribeQos: 0,
      defaultPublishQos: 0,
      defaultRetain: false,
      defaultPayloadFormat: 'text',
      autoConnectOnLaunch: false,
      createdAt: now,
      updatedAt: now,
    };
  }

  if (issued) {
    if (!profile.tls) {
      throw new Error(
        'This demo client has no TLS settings to attach a certificate to.',
      );
    }
    // Renewal overwrites the same secrets and Keychain aliases in place; the iOS
    // transport deletes and re-adds the identity under its alias on every connect.
    const prev = profile.tls.identity;
    const certRef = prev?.certRef ?? newSecretId();
    const keyRef = prev?.keyRef ?? newSecretId();
    setSecret(certRef, issued.certPem);
    setSecret(keyRef, issued.keyPem);
    profile = {
      ...profile,
      tls: {
        ...profile.tls,
        identity: {
          certRef,
          keyRef,
          keyAlgorithm: 'EC',
          keySizeBits: issued.key.keySizeBits,
          certMeta: certMetaFromPem(issued.certPem),
          iosCertAlias: prev?.iosCertAlias ?? `${profile.id}-cert`,
          iosKeyAlias: prev?.iosKeyAlias ?? `${profile.id}-key`,
        },
      },
      updatedAt: now,
    };
  }

  if (issued || !listProfiles().some(p => p.id === profile!.id)) {
    useProfilesStore.getState().save(profile);
  }

  moveToActive(profile.id, plan.topic, 0);
  useConnectionsStore.getState().connect(profile.id);

  return { profileId: profile.id };
}
