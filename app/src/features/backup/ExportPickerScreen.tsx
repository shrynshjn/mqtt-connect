import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Share from 'react-native-share';
import { writeFile, unlink, CachesDirectoryPath } from '@dr.pogodin/react-native-fs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../app/navigation';
import { colors, font, radius, space } from '../../ui/theme';
import { showPrompt } from '../../ui/PromptModal';
import { useToast } from '../../ui/Toast';
import { listProfiles } from '../../storage/profileRepo';
import { listBrokers } from '../../storage/brokerRepo';
import { schemeFor } from '../../types/profile';
import type { Broker } from '../../types/broker';
import type { ConnectionProfile } from '../../types/profile';
import { buildExportPayload } from '../../backup/exportImportPayload';
import { encryptPayload } from '../../backup/exportImportCrypto';
import { groupProfilesByBroker } from './groupByBroker';
import { SelectableRow } from './SelectableRow';

type Props = NativeStackScreenProps<RootStackParamList, 'ExportPicker'>;

export function ExportPickerScreen({ navigation }: Props) {
  const show = useToast();
  const [profiles, setProfiles] = useState<ConnectionProfile[]>([]);
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [selectedProfileIds, setSelectedProfileIds] = useState<Set<string>>(
    new Set(),
  );
  const [selectedBrokerIds, setSelectedBrokerIds] = useState<Set<string>>(
    new Set(),
  );
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      setProfiles(listProfiles());
      setBrokers(listBrokers());
    });
    return unsubscribe;
  }, [navigation]);

  const groups = groupProfilesByBroker(
    profiles,
    brokers,
    p => p.brokerId,
    b => b.id,
  );

  const totalCount = profiles.length + brokers.length;
  const selectedCount = selectedProfileIds.size + selectedBrokerIds.size;
  const allSelected = totalCount > 0 && selectedCount === totalCount;

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

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedProfileIds(new Set());
      setSelectedBrokerIds(new Set());
    } else {
      setSelectedProfileIds(new Set(profiles.map(p => p.id)));
      setSelectedBrokerIds(new Set(brokers.map(b => b.id)));
    }
  }

  async function onExportPressed() {
    if (selectedCount === 0 || busy) return;

    const pw1 = await showPrompt(
      'Set a password',
      'This encrypts the backup file. You will need this exact password to import it later.',
      { secure: true },
    );
    if (pw1 == null) return;
    if (!pw1) {
      show('Password cannot be empty');
      return;
    }

    const pw2 = await showPrompt('Confirm password', undefined, {
      secure: true,
    });
    if (pw2 == null) return;
    if (pw2 !== pw1) {
      show('Passwords did not match — try again');
      return;
    }

    setBusy(true);
    let tempPath: string | undefined;
    try {
      const payload = buildExportPayload(
        [...selectedProfileIds],
        [...selectedBrokerIds],
      );
      const encrypted = await encryptPayload(payload, pw1);

      const filename = `mqtt-connect-backup-${new Date()
        .toISOString()
        .replace(/[:.]/g, '-')}.json`;
      tempPath = `${CachesDirectoryPath}/${filename}`;
      await writeFile(tempPath, encrypted, 'utf8');

      const result = await Share.open({
        url: `file://${tempPath}`,
        type: 'application/json',
        filename,
        failOnCancel: false,
      });

      if (!result.dismissedAction) {
        show('Backup exported');
        navigation.goBack();
      }
    } catch (e) {
      show(`Export failed · ${(e as Error).message}`);
    } finally {
      if (tempPath) unlink(tempPath).catch(() => {});
      setBusy(false);
    }
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </Pressable>
        <Text style={styles.title}>Export</Text>
      </View>

      <View style={styles.summaryRow}>
        <Text style={styles.summary}>
          {selectedCount} of {totalCount} selected
        </Text>
        {totalCount > 0 && (
          <Pressable onPress={toggleSelectAll}>
            <Text style={styles.selectAll}>
              {allSelected ? 'Clear all' : 'Select all'}
            </Text>
          </Pressable>
        )}
      </View>

      <SectionList
        contentContainerStyle={styles.list}
        sections={groups.map(g => ({
          title: g.broker.id,
          broker: g.broker,
          data: g.profiles,
        }))}
        keyExtractor={p => p.id}
        renderSectionHeader={({ section }) => {
          const broker = section.broker as Broker;
          const anyChildSelected = section.data.some((p: ConnectionProfile) =>
            selectedProfileIds.has(p.id),
          );
          return (
            <SelectableRow
              title={broker.name}
              subtitle={`${schemeFor(broker.transport)}://${broker.host}:${broker.port}`}
              selected={
                selectedBrokerIds.has(broker.id) || anyChildSelected
              }
              disabled={anyChildSelected}
              onToggle={() => toggleBroker(broker.id)}
            />
          );
        }}
        renderItem={({ item }) => (
          <View style={styles.profileRow}>
            <SelectableRow
              title={item.name}
              selected={selectedProfileIds.has(item.id)}
              onToggle={() => toggleProfile(item.id)}
            />
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.emptyHint}>
            Nothing to export yet — add a client or broker first.
          </Text>
        }
        ListFooterComponent={
          <Pressable
            style={[
              styles.exportBtn,
              (selectedCount === 0 || busy) && styles.exportBtnDisabled,
            ]}
            disabled={selectedCount === 0 || busy}
            onPress={onExportPressed}
          >
            {busy && (
              <ActivityIndicator size="small" color={colors.textTertiary} />
            )}
            <Text
              style={[styles.exportText, busy && styles.exportTextBusy]}
            >
              {busy ? 'Encrypting…' : `Export ${selectedCount} selected`}
            </Text>
          </Pressable>
        }
      />
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
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.md,
    paddingTop: space.md,
  },
  summary: { fontFamily: font.mono, fontSize: 11, color: colors.textTertiary },
  selectAll: { fontSize: 12.5, fontWeight: '600', color: colors.accent },
  list: { padding: space.md, gap: space.sm },
  profileRow: { paddingLeft: space.lg },
  emptyHint: {
    fontSize: 12.5,
    color: colors.textTertiary,
    textAlign: 'center',
    paddingVertical: space.xl,
  },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 13,
    marginTop: space.sm,
  },
  exportBtnDisabled: { opacity: 0.4 },
  exportText: { fontSize: 15, fontWeight: '700', color: colors.bg },
  exportTextBusy: { color: colors.textTertiary },
});
