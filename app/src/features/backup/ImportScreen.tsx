import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../app/navigation';
import { colors, font, radius, space } from '../../ui/theme';
import { showPrompt } from '../../ui/PromptModal';
import { useToast } from '../../ui/Toast';
import { pickAndReadFile, type PickedFile } from '../../crypto/filePicker';
import { CertSlotRow } from '../profile/CertSlotRow';
import {
  applyImportPayload,
  type ExportPayload,
  type ExportedBroker,
  type ExportedProfile,
} from '../../backup/exportImportPayload';
import {
  decryptPayload,
  BackupDecryptError,
} from '../../backup/exportImportCrypto';
import { useProfilesStore } from '../../state/profilesStore';
import { groupProfilesByBroker } from './groupByBroker';
import { SelectableRow } from './SelectableRow';

type Props = NativeStackScreenProps<RootStackParamList, 'Import'>;

type Step = 'pick' | 'select';

export function ImportScreen({ navigation }: Props) {
  const show = useToast();
  const [step, setStep] = useState<Step>('pick');
  const [pickedFile, setPickedFile] = useState<PickedFile | null>(null);
  const [payload, setPayload] = useState<ExportPayload | null>(null);
  const [selectedProfileIds, setSelectedProfileIds] = useState<Set<string>>(
    new Set(),
  );
  const [selectedBrokerIds, setSelectedBrokerIds] = useState<Set<string>>(
    new Set(),
  );
  const [busy, setBusy] = useState(false);

  async function onPickFile() {
    try {
      const file = await pickAndReadFile('utf8');
      if (!file) return;
      setPickedFile(file);
      promptForPassword(file);
    } catch (e) {
      show(`Could not read file · ${(e as Error).message}`);
    }
  }

  async function promptForPassword(file: PickedFile) {
    const pw = await showPrompt(
      'Backup password',
      `Enter the password used to encrypt "${file.name}".`,
      { secure: true },
    );
    if (pw == null) return;

    setBusy(true);
    try {
      const decrypted = await decryptPayload(file.content, pw);
      setPayload(decrypted);
      setSelectedProfileIds(new Set(decrypted.profiles.map(p => p.originalId)));
      setSelectedBrokerIds(new Set(decrypted.brokers.map(b => b.originalId)));
      setStep('select');
    } catch (e) {
      show(
        e instanceof BackupDecryptError
          ? 'Wrong password — try again'
          : `Could not read backup · ${(e as Error).message}`,
      );
    } finally {
      setBusy(false);
    }
  }

  function toggleProfile(id: string) {
    setSelectedProfileIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleBroker(id: string) {
    setSelectedBrokerIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function onImportPressed() {
    if (!payload || busy) return;
    setBusy(true);
    try {
      const result = applyImportPayload(
        payload,
        [...selectedProfileIds],
        [...selectedBrokerIds],
      );
      useProfilesStore.getState().load();
      show(
        `Imported ${result.importedProfileIds.length} client${result.importedProfileIds.length === 1 ? '' : 's'}` +
          (result.importedBrokerIds.length
            ? ` · ${result.importedBrokerIds.length} broker${result.importedBrokerIds.length === 1 ? '' : 's'}`
            : ''),
      );
      navigation.popToTop();
    } catch (e) {
      show(`Import failed · ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  const selectedCount = selectedProfileIds.size + selectedBrokerIds.size;

  const groups = payload
    ? groupProfilesByBroker(
        payload.profiles,
        payload.brokers,
        p => p.originalBrokerId,
        b => b.originalId,
      )
    : [];

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </Pressable>
        <Text style={styles.title}>Import</Text>
      </View>

      {step === 'pick' && (
        <View style={styles.pickContent}>
          <CertSlotRow
            label="Backup file"
            hint="a backup exported from MQTT Connect"
            value={pickedFile ? { fileName: pickedFile.name } : null}
            onPick={onPickFile}
            onClear={() => {
              setPickedFile(null);
              setPayload(null);
            }}
          />
          {pickedFile && (
            <Pressable
              style={[styles.primaryBtn, busy && styles.primaryBtnDisabled]}
              disabled={busy}
              onPress={() => promptForPassword(pickedFile)}
            >
              {busy && (
                <ActivityIndicator size="small" color={colors.textTertiary} />
              )}
              <Text
                style={[styles.primaryText, busy && styles.primaryTextBusy]}
              >
                {busy ? 'Decrypting…' : 'Enter password'}
              </Text>
            </Pressable>
          )}
        </View>
      )}

      {step === 'select' && payload && (
        <>
          <View style={styles.summaryRow}>
            <Text style={styles.summary}>
              {selectedCount} of{' '}
              {payload.profiles.length + payload.brokers.length} selected
            </Text>
          </View>
          <SectionList
            contentContainerStyle={styles.list}
            sections={groups.map(g => ({
              title: g.broker.originalId,
              broker: g.broker,
              data: g.profiles,
            }))}
            keyExtractor={p => p.originalId}
            renderSectionHeader={({ section }) => {
              const broker = section.broker as ExportedBroker;
              const anyChildSelected = section.data.some((p: ExportedProfile) =>
                selectedProfileIds.has(p.originalId),
              );
              return (
                <SelectableRow
                  title={broker.name}
                  subtitle={`${broker.host}:${broker.port}`}
                  selected={
                    selectedBrokerIds.has(broker.originalId) || anyChildSelected
                  }
                  disabled={anyChildSelected}
                  onToggle={() => toggleBroker(broker.originalId)}
                />
              );
            }}
            renderItem={({ item }) => (
              <View style={styles.profileRow}>
                <SelectableRow
                  title={item.name}
                  selected={selectedProfileIds.has(item.originalId)}
                  onToggle={() => toggleProfile(item.originalId)}
                />
              </View>
            )}
            ListFooterComponent={
              <Pressable
                style={[
                  styles.importBtn,
                  (selectedCount === 0 || busy) && styles.importBtnDisabled,
                ]}
                disabled={selectedCount === 0 || busy}
                onPress={onImportPressed}
              >
                {busy && (
                  <ActivityIndicator size="small" color={colors.textTertiary} />
                )}
                <Text
                  style={[styles.importText, busy && styles.importTextBusy]}
                >
                  {busy ? 'Importing…' : `Import ${selectedCount} selected`}
                </Text>
              </Pressable>
            }
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: space.md,
    paddingTop: 58,
    paddingBottom: space.md,
    borderBottomColor: colors.hairline,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.hairline,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: { color: colors.textSecondary, fontSize: 15 },
  title: { fontSize: 17, fontWeight: '700', color: colors.text },
  pickContent: { padding: space.md, gap: space.md },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 13,
  },
  primaryBtnDisabled: { opacity: 0.6 },
  primaryText: { fontSize: 15, fontWeight: '700', color: colors.bg },
  primaryTextBusy: { color: colors.textTertiary },
  summaryRow: { paddingHorizontal: space.md, paddingTop: space.md },
  summary: { fontFamily: font.mono, fontSize: 11, color: colors.textTertiary },
  list: { padding: space.md, gap: space.sm },
  profileRow: { paddingLeft: space.lg },
  importBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 13,
    marginTop: space.sm,
  },
  importBtnDisabled: { opacity: 0.4 },
  importText: { fontSize: 15, fontWeight: '700', color: colors.bg },
  importTextBusy: { color: colors.textTertiary },
});
