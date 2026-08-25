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

// ISRG Root X1 — Let's Encrypt's root CA, which broker.hivemq.com:8883's certificate
// chains to. This app pins raw-TLS connections to exactly the CA configured on the
// profile (see transport/types.ts) rather than the device's trust store, so the mqtts
// demo variant needs this anchor bundled in to be a genuine one-tap button.
export const HIVEMQ_TLS_CA_PEM: string | null = `-----BEGIN CERTIFICATE-----
MIIFazCCA1OgAwIBAgIRAIIQz7DSQONZRGPgu2OCiwAwDQYJKoZIhvcNAQELBQAw
TzELMAkGA1UEBhMCVVMxKTAnBgNVBAoTIEludGVybmV0IFNlY3VyaXR5IFJlc2Vh
cmNoIEdyb3VwMRUwEwYDVQQDEwxJU1JHIFJvb3QgWDEwHhcNMTUwNjA0MTEwNDM4
WhcNMzUwNjA0MTEwNDM4WjBPMQswCQYDVQQGEwJVUzEpMCcGA1UEChMgSW50ZXJu
ZXQgU2VjdXJpdHkgUmVzZWFyY2ggR3JvdXAxFTATBgNVBAMTDElTUkcgUm9vdCBY
MTCCAiIwDQYJKoZIhvcNAQEBBQADggIPADCCAgoCggIBAK3oJHP0FDfzm54rVygc
h77ct984kIxuPOZXoHj3dcKi/vVqbvYATyjb3miGbESTtrFj/RQSa78f0uoxmyF+
0TM8ukj13Xnfs7j/EvEhmkvBioZxaUpmZmyPfjxwv60pIgbz5MDmgK7iS4+3mX6U
A5/TR5d8mUgjU+g4rk8Kb4Mu0UlXjIB0ttov0DiNewNwIRt18jA8+o+u3dpjq+sW
T8KOEUt+zwvo/7V3LvSye0rgTBIlDHCNAymg4VMk7BPZ7hm/ELNKjD+Jo2FR3qyH
B5T0Y3HsLuJvW5iB4YlcNHlsdu87kGJ55tukmi8mxdAQ4Q7e2RCOFvu396j3x+UC
B5iPNgiV5+I3lg02dZ77DnKxHZu8A/lJBdiB3QW0KtZB6awBdpUKD9jf1b0SHzUv
KBds0pjBqAlkd25HN7rOrFleaJ1/ctaJxQZBKT5ZPt0m9STJEadao0xAH0ahmbWn
OlFuhjuefXKnEgV4We0+UXgVCwOPjdAvBbI+e0ocS3MFEvzG6uBQE3xDk3SzynTn
jh8BCNAw1FtxNrQHusEwMFxIt4I7mKZ9YIqioymCzLq9gwQbooMDQaHWBfEbwrbw
qHyGO0aoSCqI3Haadr8faqU9GY/rOPNk3sgrDQoo//fb4hVC1CLQJ13hef4Y53CI
rU7m2Ys6xt0nUW7/vGT1M0NPAgMBAAGjQjBAMA4GA1UdDwEB/wQEAwIBBjAPBgNV
HRMBAf8EBTADAQH/MB0GA1UdDgQWBBR5tFnme7bl5AFzgAiIyBpY9umbbjANBgkq
hkiG9w0BAQsFAAOCAgEAVR9YqbyyqFDQDLHYGmkgJykIrGF1XIpu+ILlaS/V9lZL
ubhzEFnTIZd+50xx+7LSYK05qAvqFyFWhfFQDlnrzuBZ6brJFe+GnY+EgPbk6ZGQ
3BebYhtF8GaV0nxvwuo77x/Py9auJ/GpsMiu/X1+mvoiBOv/2X/qkSsisRcOj/KK
NFtY2PwByVS5uCbMiogziUwthDyC3+6WVwW6LLv3xLfHTjuCvjHIInNzktHCgKQ5
ORAzI4JMPJ+GslWYHb4phowim57iaztXOoJwTdwJx4nLCgdNbOhdjsnvzqvHu7Ur
TkXWStAmzOVyyghqpZXjFaH3pO3JLF+l+/+sKAIuvtd7u+Nxe5AW0wdeRlN8NwdC
jNPElpzVmbUq4JUagEiuTDkHzsxHpFKVK7q4+63SM1N95R1NbdWhscdCb+ZAJzVc
oyi3B43njTOQ5yOf+1CceWxG1bQVs5ZufpsMljq4Ui0/1lvh+wjChP4kqKOJ2qxq
4RgqsahDYVvTH9w7jXbyLeiNdd8XM2w9U/t7y0Ff/9yi0GE44Za4rF2LN9d11TPA
mRGunUHBcnWEvgJBQl9nJEiU0Zsnvgc/ubhPgXRR4Xq37Z0j4r7g1SgEEzwxA57d
emyPxgcYxn/eR44/KJ4EBs+lVDR3veyJm+kXQ99b21/+jh5Xos1AnX5iItreGCc=
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
