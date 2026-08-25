import type {
  BrokerId,
  CertMeta,
  ClientIdentity,
  ConnectionProfile,
  KeyAlgorithm,
  LastWill,
  MqttProtocolVersion,
  PayloadFormat,
  ProfileId,
  QoS,
  Transport,
} from '../types/profile';
import type { Broker } from '../types/broker';
import type { Snippet } from '../types/message';
import { getProfile, newProfileId, saveProfile } from '../storage/profileRepo';
import { getBroker, newBrokerId, saveBroker } from '../storage/brokerRepo';
import { getSecret, newSecretId, setSecret } from '../storage/secretRepo';
import {
  getActiveSubscriptions,
  getSavedTopics,
  setActiveSubscriptions,
  setSavedTopics,
  type PersistedSubscription,
  type SavedTopic,
} from '../storage/subscriptionRepo';
import { addSnippet, getSnippets } from '../storage/snippetRepo';

export const PAYLOAD_SCHEMA_VERSION = 1;

export interface ExportedBroker {
  originalId: BrokerId;
  name: string;
  host: string;
  port: number;
  transport: Transport;
  path?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExportedClientIdentity {
  certPem: string;
  chainPem?: string;
  keyPem: string;
  keyAlgorithm: KeyAlgorithm;
  keySizeBits?: number;
  certMeta: CertMeta;
}

export interface ExportedTlsConfig {
  caPem: string;
  caMeta: CertMeta;
  identity?: ExportedClientIdentity;
  keyPassphrase?: string;
  servername?: string;
}

export interface ExportedAuthConfig {
  username?: string;
  password?: string;
}

export interface ExportedProfile {
  originalId: ProfileId;
  originalBrokerId: BrokerId;

  name: string;
  sigil: string;
  clientId: string;
  protocolVersion: MqttProtocolVersion;
  cleanStart: boolean;
  keepaliveSeconds: number;
  connectTimeoutMs: number;
  reconnectPeriodMs: number;

  auth?: ExportedAuthConfig;
  tls?: ExportedTlsConfig;
  lastWill?: LastWill;

  defaultSubscribeQos: QoS;
  defaultPublishQos: QoS;
  defaultRetain: boolean;
  defaultPayloadFormat: PayloadFormat;
  autoConnectOnLaunch: boolean;

  createdAt: string;
  updatedAt: string;

  activeSubscriptions: PersistedSubscription[];
  savedTopics: SavedTopic[];
  snippets: Omit<Snippet, 'id' | 'profileId'>[];
}

export interface ExportPayload {
  schemaVersion: number;
  exportedAt: string;
  brokers: ExportedBroker[];
  profiles: ExportedProfile[];
}

function exportBroker(broker: Broker): ExportedBroker {
  return {
    originalId: broker.id,
    name: broker.name,
    host: broker.host,
    port: broker.port,
    transport: broker.transport,
    path: broker.path,
    createdAt: broker.createdAt,
    updatedAt: broker.updatedAt,
  };
}

/** Returns `undefined` if the profile can't be fully resolved (missing broker, or a
 * secret ref that's evaporated from storage independently of the profile) — such a
 * profile isn't worth backing up, since it couldn't reconnect anyway. */
function exportProfile(
  profile: ConnectionProfile,
): ExportedProfile | undefined {
  const broker = getBroker(profile.brokerId);
  if (!broker) return undefined;

  let auth: ExportedAuthConfig | undefined;
  if (profile.auth) {
    const password = profile.auth.passwordRef
      ? getSecret(profile.auth.passwordRef)
      : undefined;
    if (profile.auth.passwordRef && password == null) return undefined;
    auth = { username: profile.auth.username, password };
  }

  let tls: ExportedTlsConfig | undefined;
  if (profile.tls) {
    const caPem = getSecret(profile.tls.caRef);
    if (caPem == null) return undefined;

    let identity: ExportedClientIdentity | undefined;
    if (profile.tls.identity) {
      const certPem = getSecret(profile.tls.identity.certRef);
      const keyPem = getSecret(profile.tls.identity.keyRef);
      if (certPem == null || keyPem == null) return undefined;
      const chainPem = profile.tls.identity.chainRef
        ? getSecret(profile.tls.identity.chainRef)
        : undefined;
      identity = {
        certPem,
        chainPem,
        keyPem,
        keyAlgorithm: profile.tls.identity.keyAlgorithm,
        keySizeBits: profile.tls.identity.keySizeBits,
        certMeta: profile.tls.identity.certMeta,
      };
    }

    const keyPassphrase = profile.tls.keyPassphraseRef
      ? getSecret(profile.tls.keyPassphraseRef)
      : undefined;
    if (profile.tls.keyPassphraseRef && keyPassphrase == null) return undefined;

    tls = {
      caPem,
      caMeta: profile.tls.caMeta,
      identity,
      keyPassphrase,
      servername: profile.tls.servername,
    };
  }

  return {
    originalId: profile.id,
    originalBrokerId: profile.brokerId,
    name: profile.name,
    sigil: profile.sigil,
    clientId: profile.clientId,
    protocolVersion: profile.protocolVersion,
    cleanStart: profile.cleanStart,
    keepaliveSeconds: profile.keepaliveSeconds,
    connectTimeoutMs: profile.connectTimeoutMs,
    reconnectPeriodMs: profile.reconnectPeriodMs,
    auth,
    tls,
    lastWill: profile.lastWill,
    defaultSubscribeQos: profile.defaultSubscribeQos,
    defaultPublishQos: profile.defaultPublishQos,
    defaultRetain: profile.defaultRetain,
    defaultPayloadFormat: profile.defaultPayloadFormat,
    autoConnectOnLaunch: profile.autoConnectOnLaunch,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
    activeSubscriptions: getActiveSubscriptions(profile.id),
    savedTopics: getSavedTopics(profile.id),
    snippets: getSnippets(profile.id).map(
      ({ id: _id, profileId: _profileId, ...rest }) => rest,
    ),
  };
}

export function buildExportPayload(
  profileIds: ProfileId[],
  brokerIds: BrokerId[],
): ExportPayload {
  const selectedProfiles = profileIds
    .map(id => getProfile(id))
    .filter((p): p is ConnectionProfile => p != null);

  const exportedProfiles = selectedProfiles
    .map(exportProfile)
    .filter((p): p is ExportedProfile => p != null);

  const brokerIdsNeeded = new Set([
    ...brokerIds,
    ...exportedProfiles.map(p => p.originalBrokerId),
  ]);
  const exportedBrokers = [...brokerIdsNeeded]
    .map(id => getBroker(id))
    .filter((b): b is Broker => b != null)
    .map(exportBroker);

  return {
    schemaVersion: PAYLOAD_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    brokers: exportedBrokers,
    profiles: exportedProfiles,
  };
}

export function applyImportPayload(
  payload: ExportPayload,
  selectedProfileIds: ProfileId[],
  selectedBrokerIds: BrokerId[],
): { importedProfileIds: ProfileId[]; importedBrokerIds: BrokerId[] } {
  const selectedProfileIdSet = new Set(selectedProfileIds);
  const selectedProfiles = payload.profiles.filter(p =>
    selectedProfileIdSet.has(p.originalId),
  );

  const brokerIdsToCreate = new Set([
    ...selectedBrokerIds,
    ...selectedProfiles.map(p => p.originalBrokerId),
  ]);

  const brokerIdMap = new Map<BrokerId, BrokerId>();
  const importedBrokerIds: BrokerId[] = [];
  for (const originalBrokerId of brokerIdsToCreate) {
    const exported = payload.brokers.find(
      b => b.originalId === originalBrokerId,
    );
    if (!exported) continue;
    const newId = newBrokerId();
    saveBroker({
      id: newId,
      name: exported.name,
      host: exported.host,
      port: exported.port,
      transport: exported.transport,
      path: exported.path,
      createdAt: exported.createdAt,
      updatedAt: exported.updatedAt,
    });
    brokerIdMap.set(originalBrokerId, newId);
    importedBrokerIds.push(newId);
  }

  const importedProfileIds: ProfileId[] = [];
  for (const exported of selectedProfiles) {
    const newBrokerIdForProfile = brokerIdMap.get(exported.originalBrokerId);
    if (!newBrokerIdForProfile) continue;

    const profileId = newProfileId();

    let auth: ConnectionProfile['auth'];
    if (exported.auth) {
      const passwordRef = exported.auth.password ? newSecretId() : undefined;
      if (passwordRef && exported.auth.password != null) {
        setSecret(passwordRef, exported.auth.password);
      }
      auth = { username: exported.auth.username, passwordRef };
    }

    let tls: ConnectionProfile['tls'];
    if (exported.tls) {
      const caRef = newSecretId();
      setSecret(caRef, exported.tls.caPem);

      let identity: ClientIdentity | undefined;
      if (exported.tls.identity) {
        const certRef = newSecretId();
        const keyRef = newSecretId();
        setSecret(certRef, exported.tls.identity.certPem);
        setSecret(keyRef, exported.tls.identity.keyPem);
        let chainRef: string | undefined;
        if (exported.tls.identity.chainPem) {
          chainRef = newSecretId();
          setSecret(chainRef, exported.tls.identity.chainPem);
        }
        identity = {
          certRef,
          chainRef,
          keyRef,
          keyAlgorithm: exported.tls.identity.keyAlgorithm,
          keySizeBits: exported.tls.identity.keySizeBits,
          certMeta: exported.tls.identity.certMeta,
          iosCertAlias: `${profileId}-cert`,
          iosKeyAlias: `${profileId}-key`,
        };
      }

      const keyPassphraseRef = exported.tls.keyPassphrase
        ? newSecretId()
        : undefined;
      if (keyPassphraseRef && exported.tls.keyPassphrase != null) {
        setSecret(keyPassphraseRef, exported.tls.keyPassphrase);
      }

      tls = {
        caRef,
        caMeta: exported.tls.caMeta,
        identity,
        keyPassphraseRef,
        servername: exported.tls.servername,
      };
    }

    saveProfile({
      id: profileId,
      schemaVersion: 0, // overwritten unconditionally by saveProfile()
      name: exported.name,
      sigil: exported.sigil,
      brokerId: newBrokerIdForProfile,
      clientId: exported.clientId,
      protocolVersion: exported.protocolVersion,
      cleanStart: exported.cleanStart,
      keepaliveSeconds: exported.keepaliveSeconds,
      connectTimeoutMs: exported.connectTimeoutMs,
      reconnectPeriodMs: exported.reconnectPeriodMs,
      auth,
      tls,
      lastWill: exported.lastWill,
      defaultSubscribeQos: exported.defaultSubscribeQos,
      defaultPublishQos: exported.defaultPublishQos,
      defaultRetain: exported.defaultRetain,
      defaultPayloadFormat: exported.defaultPayloadFormat,
      autoConnectOnLaunch: exported.autoConnectOnLaunch,
      createdAt: exported.createdAt,
      updatedAt: new Date().toISOString(),
    });

    setActiveSubscriptions(profileId, exported.activeSubscriptions);
    setSavedTopics(profileId, exported.savedTopics);
    for (const snippet of exported.snippets) {
      addSnippet({ ...snippet, profileId });
    }

    importedProfileIds.push(profileId);
  }

  return { importedProfileIds, importedBrokerIds };
}
