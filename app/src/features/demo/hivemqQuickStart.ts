import 'react-native-get-random-values';
import type { ConnectionProfile, Transport } from '../../types/profile';
import { listBrokers, newBrokerId, saveBroker } from '../../storage/brokerRepo';
import { listProfiles, newProfileId } from '../../storage/profileRepo';
import { newSecretId, setSecret } from '../../storage/secretRepo';
import {
  getActiveSubscriptions,
  moveToActive,
} from '../../storage/subscriptionRepo';
import { certMetaFromPem } from '../../crypto/certInfo';
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
  transport: Transport;
  scheme: string;
  label: string;
  port: number;
  path?: string;
  requiresCa: boolean;
}

export const DEMO_VARIANTS: DemoVariant[] = [
  {
    transport: 'tcp',
    scheme: 'mqtt',
    label: 'MQTT',
    port: 1883,
    requiresCa: false,
  },
  {
    transport: 'tls',
    scheme: 'mqtts',
    label: 'MQTT over TLS',
    port: 8883,
    requiresCa: true,
  },
  {
    transport: 'ws',
    scheme: 'ws',
    label: 'WebSocket',
    port: 8000,
    path: WS_PATH,
    requiresCa: false,
  },
  {
    transport: 'wss',
    scheme: 'wss',
    label: 'WebSocket over TLS',
    port: 8884,
    path: WS_PATH,
    requiresCa: false,
  },
];

function demoName(variant: DemoVariant): string {
  return `HiveMQ demo · ${variant.scheme}`;
}

function randomHex(bytes: number): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(bytes)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
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
}

/** Pure — computes exactly what a tap on `variant` would set up, without writing
 * anything, so the confirmation screen can show the user the real values (including a
 * previously-created demo client's actual client ID and topic, if this variant was
 * already set up once) before anything happens. */
export function buildQuickStartPlan(variant: DemoVariant): QuickStartPlan {
  const name = demoName(variant);
  const existingBroker = listBrokers().find(
    b =>
      b.host === HIVEMQ_HOST &&
      b.transport === variant.transport &&
      b.port === variant.port,
  );
  const existingProfile = existingBroker
    ? listProfiles().find(p => p.brokerId === existingBroker.id)
    : undefined;

  if (existingProfile) {
    const [existingSub] = getActiveSubscriptions(existingProfile.id);
    return {
      variant,
      reusingClient: true,
      reusingBroker: true,
      brokerName: name,
      host: HIVEMQ_HOST,
      port: variant.port,
      path: variant.path,
      clientId: existingProfile.clientId,
      topic: existingSub?.topic ?? `mqtt-connect/demo/${randomHex(4)}`,
    };
  }

  return {
    variant,
    reusingClient: false,
    reusingBroker: !!existingBroker,
    brokerName: name,
    host: HIVEMQ_HOST,
    port: variant.port,
    path: variant.path,
    clientId: `mqtt-connect-demo-${randomHex(4)}`,
    topic: `mqtt-connect/demo/${randomHex(4)}`,
  };
}

/** Executes a previously-built plan: creates (or reuses) the broker and client profile,
 * persists the topic subscription so it's picked up automatically on connect, and
 * starts connecting. `caPem` is required and used only for the 'tls' variant when
 * `HIVEMQ_TLS_CA_PEM` hasn't been filled in — see that constant's comment. */
export function commitQuickStartPlan(
  plan: QuickStartPlan,
  caPem?: string,
): { profileId: string } {
  const now = new Date().toISOString();

  let broker = listBrokers().find(
    b =>
      b.host === plan.host &&
      b.transport === plan.variant.transport &&
      b.port === plan.port,
  );
  if (!broker) {
    broker = {
      id: newBrokerId(),
      name: plan.brokerName,
      host: plan.host,
      port: plan.port,
      transport: plan.variant.transport,
      path: plan.path,
      createdAt: now,
      updatedAt: now,
    };
    saveBroker(broker);
  }

  let profile = listProfiles().find(p => p.brokerId === broker!.id);
  if (!profile) {
    let tls: ConnectionProfile['tls'];
    if (plan.variant.requiresCa) {
      const pem = HIVEMQ_TLS_CA_PEM ?? caPem;
      if (!pem) {
        throw new Error(
          'A CA certificate is required for this connection but none was provided.',
        );
      }
      const caRef = newSecretId();
      setSecret(caRef, pem);
      tls = { caRef, caMeta: certMetaFromPem(pem) };
    }

    profile = {
      id: newProfileId(),
      schemaVersion: 2,
      name: plan.brokerName,
      sigil: 'HQ',
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
    useProfilesStore.getState().save(profile);
  }

  moveToActive(profile.id, plan.topic, 0);
  useConnectionsStore.getState().connect(profile.id);

  return { profileId: profile.id };
}
