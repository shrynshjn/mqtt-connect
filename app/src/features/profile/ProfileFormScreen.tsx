import React, { useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../app/navigation';
import { colors, font, radius, space } from '../../ui/theme';
import { SegmentedControl } from '../../ui/SegmentedControl';
import { ToggleSwitch } from '../../ui/ToggleSwitch';
import { useProfilesStore } from '../../state/profilesStore';
import { newProfileId, getProfile } from '../../storage/profileRepo';
import { newSecretId, setSecret, getSecret } from '../../storage/secretRepo';
import { certMetaFromPem } from '../../crypto/certInfo';
import {
  parsePrivateKeyPem,
  toCanonicalPem,
} from '../../crypto/keyNormalize';
import { unwrapPkcs12 } from '../../crypto/pkcs12';
import { splitAndClassifyPem } from '../../crypto/pem';
import { pickAndReadFile } from '../../crypto/filePicker';
import { showPrompt } from '../../ui/PromptModal';
import { CertSlotRow, type CertSlotValue } from './CertSlotRow';
import { stripSmartPunctuation } from '../../ui/sanitizeText';
import { getBroker } from '../../storage/brokerRepo';
import { schemeFor } from '../../types/profile';
import { BrokerPickerModal } from '../brokers/BrokerPickerModal';
import type { Broker, BrokerId } from '../../types/broker';
import {
  isTlsTransport,
  type CertMeta,
  type KeyAlgorithm,
  type MqttProtocolVersion,
} from '../../types/profile';

type Props = NativeStackScreenProps<RootStackParamList, 'ProfileForm'>;

interface CaSlot {
  pem: string;
  fileName: string;
  meta: CertMeta;
}
interface CertSlotState {
  pem: string;
  fileName: string;
  meta: CertMeta;
}
interface KeySlotState {
  pem: string;
  fileName: string;
  keyAlgorithm: KeyAlgorithm;
  keySizeBits?: number;
}

export function ProfileFormScreen({ route, navigation }: Props) {
  const existing = route.params.profileId
    ? getProfile(route.params.profileId)
    : undefined;
  const save = useProfilesStore(s => s.save);
  const remove = useProfilesStore(s => s.remove);

  const [name, setName] = useState(existing?.name ?? '');
  const [brokerId, setBrokerId] = useState<BrokerId | null>(existing?.brokerId ?? null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const broker = brokerId ? getBroker(brokerId) : undefined;
  const [clientId, setClientId] = useState(
    existing?.clientId ??
      `mqtt-connect-${Math.random().toString(16).slice(2, 8)}`,
  );
  const [protocolVersion, setProtocolVersion] = useState<MqttProtocolVersion>(
    existing?.protocolVersion ?? 5,
  );
  const [keepalive, setKeepalive] = useState(existing?.keepaliveSeconds ?? 60);
  const [cleanStart, setCleanStart] = useState(existing?.cleanStart ?? true);

  const [username, setUsername] = useState(existing?.auth?.username ?? '');
  const [password, setPassword] = useState(
    existing?.auth?.passwordRef
      ? (getSecret(existing.auth.passwordRef) ?? '')
      : '',
  );
  const [showPassword, setShowPassword] = useState(false);

  const [certOn, setCertOn] = useState(!!existing?.tls?.identity);
  const [ca, setCa] = useState<CaSlot | null>(
    existing?.tls
      ? {
          pem: getSecret(existing.tls.caRef) ?? '',
          fileName: 'ca.pem',
          meta: existing.tls.caMeta,
        }
      : null,
  );
  const [cert, setCert] = useState<CertSlotState | null>(
    existing?.tls?.identity
      ? {
          pem: getSecret(existing.tls.identity.certRef) ?? '',
          fileName: 'client.crt',
          meta: existing.tls.identity.certMeta,
        }
      : null,
  );
  const [key, setKey] = useState<KeySlotState | null>(
    existing?.tls?.identity
      ? {
          pem: getSecret(existing.tls.identity.keyRef) ?? '',
          fileName: 'client.key',
          keyAlgorithm: existing.tls.identity.keyAlgorithm,
          keySizeBits: existing.tls.identity.keySizeBits,
        }
      : null,
  );
  const [pendingPassphraseFile, setPendingPassphraseFile] = useState<{
    pem: string;
    fileName: string;
  } | null>(null);
  const [keyPassphrase, setKeyPassphrase] = useState('');

  const isTls = broker ? isTlsTransport(broker.transport) : false;

  function onBrokerSelected(picked: Broker) {
    setBrokerId(picked.id);
    setPickerOpen(false);
  }

  async function pickCa() {
    try {
      const file = await pickAndReadFile('utf8');
      if (!file) return;
      setCa({
        pem: file.content,
        fileName: file.name,
        meta: certMetaFromPem(file.content),
      });
    } catch (e) {
      Alert.alert('Could not import CA certificate', (e as Error).message);
    }
  }

  async function pickCert() {
    try {
      const file = await pickAndReadFile('utf8');
      if (!file) return;
      setCert({
        pem: file.content,
        fileName: file.name,
        meta: certMetaFromPem(file.content),
      });
    } catch (e) {
      Alert.alert('Could not import client certificate', (e as Error).message);
    }
  }

  async function pickKey() {
    try {
      const file = await pickAndReadFile('utf8');
      if (!file) return;
      tryParseKey(file.content, file.name, undefined);
    } catch (e) {
      Alert.alert('Could not read key file', (e as Error).message);
    }
  }

  function tryParseKey(
    pem: string,
    fileName: string,
    passphrase: string | undefined,
  ) {
    try {
      const parsed = parsePrivateKeyPem(pem, passphrase);
      setKey({
        pem: toCanonicalPem(parsed.forgeKey),
        fileName,
        keyAlgorithm: parsed.algorithm,
        keySizeBits: parsed.keySizeBits,
      });
      setPendingPassphraseFile(null);
      setKeyPassphrase('');
    } catch (e) {
      if ((e as Error).message.includes('needs its passphrase')) {
        setPendingPassphraseFile({ pem, fileName });
      } else {
        Alert.alert('Could not import client key', (e as Error).message);
      }
    }
  }

  async function pickBundle() {
    try {
      const file = await pickAndReadFile('base64');
      if (!file) return;
      const pw = await showPrompt(
        'Bundle password',
        `Enter the password for ${file.name}`,
        { secure: true },
      );
      if (pw != null) applyBundle(file.content, pw);
    } catch (e) {
      Alert.alert('Could not read bundle', (e as Error).message);
    }
  }

  function applyBundle(base64: string, password_: string) {
    try {
      const bundle = unwrapPkcs12(base64, password_);
      setCert({
        pem: bundle.certPem,
        fileName: 'bundle (cert)',
        meta: certMetaFromPem(bundle.certPem),
      });
      setKey({
        pem: bundle.keyPem,
        fileName: 'bundle (key)',
        keyAlgorithm: 'RSA',
        keySizeBits: bundle.keySizeBits,
      });
      if (bundle.chainPems[0] && !ca) {
        setCa({
          pem: bundle.chainPems[0],
          fileName: 'bundle (ca)',
          meta: certMetaFromPem(bundle.chainPems[0]),
        });
      }
    } catch (e) {
      Alert.alert('Could not open bundle', (e as Error).message);
    }
  }

  async function pasteCert() {
    const text = await showPrompt(
      'Paste PEM text',
      'Paste one or more PEM blocks (CA, certificate, and/or key)',
      { multiline: true },
    );
    if (text != null) applyPastedPem(text);
  }

  function applyPastedPem(text: string) {
    const blocks = splitAndClassifyPem(text);
    blocks.forEach(b => {
      if (b.kind === 'privateKey') {
        tryParseKey(b.pem, 'pasted key', undefined);
      } else if (!ca) {
        setCa({
          pem: b.pem,
          fileName: 'pasted CA',
          meta: certMetaFromPem(b.pem),
        });
      } else {
        setCert({
          pem: b.pem,
          fileName: 'pasted certificate',
          meta: certMetaFromPem(b.pem),
        });
      }
    });
  }

  function onSave() {
    if (!name.trim()) {
      Alert.alert('Missing details', 'Give this client a name.');
      return;
    }
    if (!brokerId) {
      Alert.alert('Broker required', 'Pick which broker this client connects to.');
      return;
    }
    if (isTls && !ca) {
      Alert.alert(
        'CA certificate required',
        'A CA certificate is required for every TLS connection — this is what makes the server’s identity actually get verified.',
      );
      return;
    }
    if (certOn && (!cert || !key)) {
      Alert.alert(
        'Client certificate incomplete',
        'Both a client certificate and its private key are required to enable mTLS.',
      );
      return;
    }

    const id = existing?.id ?? newProfileId();
    const passwordRef = password
      ? (existing?.auth?.passwordRef ?? newSecretId())
      : undefined;
    if (passwordRef) setSecret(passwordRef, password);

    let tls: import('../../types/profile').TlsConfig | undefined;
    if (isTls && ca) {
      const caRef = existing?.tls?.caRef ?? newSecretId();
      setSecret(caRef, ca.pem);

      let identity: import('../../types/profile').ClientIdentity | undefined;
      if (certOn && cert && key) {
        const certRef = existing?.tls?.identity?.certRef ?? newSecretId();
        const keyRef = existing?.tls?.identity?.keyRef ?? newSecretId();
        setSecret(certRef, cert.pem);
        setSecret(keyRef, key.pem);
        identity = {
          certRef,
          keyRef,
          keyAlgorithm: key.keyAlgorithm,
          keySizeBits: key.keySizeBits,
          certMeta: cert.meta,
          iosCertAlias: existing?.tls?.identity?.iosCertAlias ?? `${id}-cert`,
          iosKeyAlias: existing?.tls?.identity?.iosKeyAlias ?? `${id}-key`,
        };
      }
      tls = { caRef, caMeta: ca.meta, identity };
    }

    const now = new Date().toISOString();
    save({
      id,
      schemaVersion: 2,
      name: name.trim(),
      sigil: name.trim().slice(0, 2).toUpperCase(),
      brokerId,
      clientId,
      protocolVersion,
      cleanStart,
      keepaliveSeconds: keepalive,
      connectTimeoutMs: existing?.connectTimeoutMs ?? 20000,
      reconnectPeriodMs: existing?.reconnectPeriodMs ?? 3000,
      auth:
        username || passwordRef
          ? { username: username || undefined, passwordRef }
          : undefined,
      tls,
      defaultSubscribeQos: existing?.defaultSubscribeQos ?? 0,
      defaultPublishQos: existing?.defaultPublishQos ?? 0,
      defaultRetain: existing?.defaultRetain ?? false,
      defaultPayloadFormat: existing?.defaultPayloadFormat ?? 'text',
      autoConnectOnLaunch: existing?.autoConnectOnLaunch ?? false,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      lastConnectedAt: existing?.lastConnectedAt,
    });
    navigation.goBack();
  }

  function onDelete() {
    if (!existing) return;
    Alert.alert(
      'Delete client',
      `Delete "${existing.name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            remove(existing.id);
            navigation.goBack();
          },
        },
      ],
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()}>
          <Text style={styles.cancel}>Cancel</Text>
        </Pressable>
        <Text style={styles.title}>
          {existing ? 'Edit client' : 'New client'}
        </Text>
        <Pressable onPress={onSave}>
          <Text style={styles.save}>Save</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Client</Text>
          <View style={styles.card}>
            <FieldRow
              label="Name"
              value={name}
              onChangeText={v => setName(stripSmartPunctuation(v))}
            />
            <View style={[styles.fieldRow, styles.fieldRowLast]}>
              <Text style={styles.fieldLabel}>Client ID</Text>
              <TextInput
                value={clientId}
                onChangeText={v => setClientId(stripSmartPunctuation(v))}
                autoCapitalize="none"
                autoCorrect={false}
                spellCheck={false}
                style={[
                  styles.fieldInput,
                  { fontFamily: font.mono, fontSize: 13 },
                ]}
              />
              <Pressable
                onPress={() =>
                  setClientId(
                    `mqtt-connect-${Math.random().toString(16).slice(2, 8)}`,
                  )
                }
              >
                <Text style={styles.showHide}>New</Text>
              </Pressable>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Broker</Text>
          <Pressable style={styles.card} onPress={() => setPickerOpen(true)}>
            <View style={[styles.fieldRow, styles.fieldRowLast]}>
              {broker ? (
                <View style={{ flex: 1 }}>
                  <Text style={styles.brokerName}>{broker.name}</Text>
                  <Text style={styles.brokerHost}>
                    {schemeFor(broker.transport)}://{broker.host}:{broker.port}
                  </Text>
                </View>
              ) : (
                <Text style={styles.brokerPlaceholder}>Choose a broker</Text>
              )}
              <Text style={styles.chevron}>›</Text>
            </View>
          </Pressable>
          <Text style={styles.hint}>
            A broker is saved separately so multiple clients can share the same one — pick an existing broker or add
            a new one here.
          </Text>
        </View>

        <BrokerPickerModal
          visible={pickerOpen}
          onSelect={onBrokerSelected}
          onClose={() => setPickerOpen(false)}
        />

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Authentication</Text>
          <View style={styles.card}>
            <FieldRow
              label="Username"
              value={username}
              onChangeText={setUsername}
            />
            <View style={[styles.fieldRow, styles.fieldRowLast]}>
              <Text style={styles.fieldLabel}>Password</Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                style={[styles.fieldInput, { fontFamily: font.mono }]}
              />
              <Pressable onPress={() => setShowPassword(v => !v)}>
                <Text style={styles.showHide}>
                  {showPassword ? 'Hide' : 'Show'}
                </Text>
              </Pressable>
            </View>
          </View>

          {isTls && (
            <View style={styles.certCard}>
              <View style={styles.certHeader}>
                <Text style={styles.certTitle}>Client certificate (mTLS)</Text>
                <ToggleSwitch value={certOn} onChange={setCertOn} />
              </View>

              {certOn && (
                <View style={{ gap: space.sm }}>
                  <CertSlotRow
                    label="CA certificate"
                    hint="ca.pem"
                    value={ca ? toSlotValue(ca.fileName, ca.meta) : null}
                    onPick={pickCa}
                    onClear={() => setCa(null)}
                  />
                  <CertSlotRow
                    label="Client certificate"
                    hint="client.crt"
                    value={cert ? toSlotValue(cert.fileName, cert.meta) : null}
                    onPick={pickCert}
                    onClear={() => setCert(null)}
                  />
                  <CertSlotRow
                    label="Client private key"
                    hint="client.key"
                    value={key ? toSlotValue(key.fileName) : null}
                    onPick={pickKey}
                    onClear={() => setKey(null)}
                  />

                  {pendingPassphraseFile && (
                    <View style={styles.passphraseBox}>
                      <Text style={styles.passphraseLabel}>
                        "{pendingPassphraseFile.fileName}" is encrypted
                      </Text>
                      <TextInput
                        value={keyPassphrase}
                        onChangeText={setKeyPassphrase}
                        placeholder="Key passphrase"
                        placeholderTextColor={colors.textTertiary}
                        secureTextEntry
                        style={styles.passphraseInput}
                      />
                      <Pressable
                        style={styles.unlockBtn}
                        onPress={() =>
                          tryParseKey(
                            pendingPassphraseFile.pem,
                            pendingPassphraseFile.fileName,
                            keyPassphrase,
                          )
                        }
                      >
                        <Text style={styles.unlockText}>Unlock</Text>
                      </Pressable>
                    </View>
                  )}

                  <View style={styles.bulkRow}>
                    <Pressable style={styles.bulkBtn} onPress={pickBundle}>
                      <Text style={styles.bulkText}>Import .p12 bundle</Text>
                    </Pressable>
                    <Pressable style={styles.bulkBtn} onPress={pasteCert}>
                      <Text style={styles.bulkText}>Paste PEM text</Text>
                    </Pressable>
                  </View>
                  <Text style={styles.hint}>
                    Files are read once through the system picker, then stored
                    in the device keychain. They are never copied off the phone
                    and are excluded from profile export.
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>MQTT options</Text>
          <View style={styles.card}>
            <View style={styles.fieldRow}>
              <Text style={[styles.fieldLabel, { flex: 1 }]}>
                Protocol version
              </Text>
              <SegmentedControl
                options={[
                  { value: 4, label: '3.1.1' },
                  { value: 5, label: '5.0' },
                ]}
                value={protocolVersion}
                onChange={setProtocolVersion}
              />
            </View>
            <View style={styles.fieldRow}>
              <Text style={[styles.fieldLabel, { flex: 1 }]}>Keep alive</Text>
              <View style={styles.stepper}>
                <Pressable
                  onPress={() => setKeepalive(v => Math.max(15, v - 15))}
                  style={styles.stepperBtn}
                >
                  <Text style={styles.stepperText}>−</Text>
                </Pressable>
                <Text style={styles.stepperValue}>{keepalive} s</Text>
                <Pressable
                  onPress={() => setKeepalive(v => Math.min(600, v + 15))}
                  style={styles.stepperBtn}
                >
                  <Text style={styles.stepperText}>+</Text>
                </Pressable>
              </View>
            </View>
            <View style={[styles.fieldRow, styles.fieldRowLast]}>
              <Text style={[styles.fieldLabel, { flex: 1 }]}>
                Clean session
              </Text>
              <ToggleSwitch value={cleanStart} onChange={setCleanStart} />
            </View>
          </View>
        </View>

        {existing && (
          <Pressable style={styles.deleteBtn} onPress={onDelete}>
            <Text style={styles.deleteText}>Delete client</Text>
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}

function toSlotValue(fileName: string, meta?: CertMeta): CertSlotValue {
  return { fileName, meta };
}

function FieldRow({
  label,
  value,
  onChangeText,
  mono,
  last,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  mono?: boolean;
  last?: boolean;
  keyboardType?: 'default' | 'number-pad';
}) {
  return (
    <View style={[styles.fieldRow, last && styles.fieldRowLast]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        style={[
          styles.fieldInput,
          mono && { fontFamily: font.mono, fontSize: 13 },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingTop: 58,
    paddingBottom: space.md,
    borderBottomColor: colors.hairline,
    borderBottomWidth: 1,
  },
  cancel: { fontSize: 15, color: colors.textSecondary },
  title: { fontSize: 16, fontWeight: '700', color: colors.text },
  save: { fontSize: 15, fontWeight: '700', color: colors.accent },
  content: { padding: space.lg, gap: space.xl },
  section: { gap: space.sm },
  sectionLabel: {
    fontFamily: font.mono,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.textTertiary,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.hairline,
    borderWidth: 1,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderBottomColor: colors.hairline,
    borderBottomWidth: 1,
  },
  fieldRowLast: { borderBottomWidth: 0 },
  fieldLabel: { fontSize: 14, color: colors.textSecondary, width: 90 },
  fieldInput: {
    flex: 1,
    textAlign: 'right',
    fontSize: 14,
    color: colors.text,
    padding: 0,
  },
  showHide: { fontSize: 12, fontWeight: '600', color: colors.accent },
  brokerName: { fontSize: 14, fontWeight: '600', color: colors.text },
  brokerHost: { fontFamily: font.mono, fontSize: 11, color: colors.textTertiary, marginTop: 2 },
  brokerPlaceholder: { flex: 1, fontSize: 14, color: colors.textTertiary },
  chevron: { fontSize: 16, color: colors.textTertiary },
  certCard: {
    backgroundColor: colors.surface,
    borderColor: colors.faultBorder,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: 14,
    gap: 11,
  },
  certHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  certTitle: { fontSize: 14, fontWeight: '600', color: colors.text, flex: 1 },
  passphraseBox: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.hairline,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: 10,
    gap: 8,
  },
  passphraseLabel: { fontSize: 12, color: colors.textSecondary },
  passphraseInput: {
    backgroundColor: colors.bg,
    borderColor: colors.hairline,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: colors.text,
    fontFamily: font.mono,
  },
  unlockBtn: {
    alignSelf: 'flex-start',
    backgroundColor: colors.accentDim,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  unlockText: { fontSize: 12.5, fontWeight: '600', color: colors.accent },
  bulkRow: { flexDirection: 'row', gap: 8 },
  bulkBtn: {
    flex: 1,
    alignItems: 'center',
    borderColor: colors.hairline,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: radius.md,
    paddingVertical: 11,
  },
  bulkText: { fontSize: 12.5, fontWeight: '600', color: colors.textSecondary },
  hint: {
    fontFamily: font.mono,
    fontSize: 10,
    lineHeight: 16,
    color: colors.textTertiary,
  },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepperBtn: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderColor: colors.hairline,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperText: { color: colors.textSecondary, fontSize: 15 },
  stepperValue: {
    fontFamily: font.mono,
    fontSize: 13,
    color: colors.text,
    minWidth: 44,
    textAlign: 'center',
  },
  deleteBtn: {
    alignItems: 'center',
    borderColor: colors.faultBorder,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingVertical: 13,
  },
  deleteText: { fontSize: 14, fontWeight: '600', color: colors.fault },
});
