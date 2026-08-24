import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors, font, radius, space } from '../../ui/theme';
import { schemeFor } from '../../types/profile';
import { listBrokers, newBrokerId, saveBroker } from '../../storage/brokerRepo';
import type { Broker } from '../../types/broker';
import { BrokerFields, type BrokerDraft } from './BrokerFields';

const EMPTY_DRAFT: BrokerDraft = {
  name: '',
  host: '',
  port: '8883',
  transport: 'tls',
};

export function BrokerPickerModal({
  visible,
  onSelect,
  onClose,
}: {
  visible: boolean;
  onSelect: (broker: Broker) => void;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<'list' | 'create'>('list');
  const [draft, setDraft] = useState<BrokerDraft>(EMPTY_DRAFT);
  const brokers = visible ? listBrokers() : [];

  function close() {
    setMode('list');
    setDraft(EMPTY_DRAFT);
    onClose();
  }

  function createAndSelect() {
    if (!draft.name.trim() || !draft.host.trim()) return;
    const now = new Date().toISOString();
    const broker: Broker = {
      id: newBrokerId(),
      name: draft.name.trim(),
      host: draft.host.trim(),
      port: Number(draft.port) || 8883,
      transport: draft.transport,
      createdAt: now,
      updatedAt: now,
    };
    saveBroker(broker);
    onSelect(broker);
    close();
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={close}
    >
      <Pressable style={styles.backdrop} onPress={close}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.handle} />
          <Text style={styles.title}>
            {mode === 'list' ? 'Choose a broker' : 'New broker'}
          </Text>

          {mode === 'list' ? (
            <ScrollView style={styles.list}>
              {brokers.length === 0 && (
                <Text style={styles.emptyHint}>No saved brokers yet.</Text>
              )}
              {brokers.map(b => (
                <Pressable
                  key={b.id}
                  style={styles.row}
                  onPress={() => onSelect(b)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowName}>{b.name}</Text>
                    <Text style={styles.rowHost}>
                      {schemeFor(b.transport)}://{b.host}:{b.port}
                    </Text>
                  </View>
                  <Text style={styles.chevron}>›</Text>
                </Pressable>
              ))}
              <Pressable
                style={styles.newBrokerRow}
                onPress={() => setMode('create')}
              >
                <Text style={styles.newBrokerText}>+ New broker</Text>
              </Pressable>
            </ScrollView>
          ) : (
            <View style={{ gap: space.md }}>
              <BrokerFields draft={draft} onChange={setDraft} />
              <View style={styles.actions}>
                <Pressable style={styles.primaryBtn} onPress={createAndSelect}>
                  <Text style={styles.primaryText}>Save & use this broker</Text>
                </Pressable>
                <Pressable
                  style={styles.ghostBtn}
                  onPress={() => setMode('list')}
                >
                  <Text style={styles.ghostText}>Back</Text>
                </Pressable>
              </View>
            </View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(4,7,13,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopColor: colors.hairlineHi,
    borderTopWidth: 1,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: space.lg,
    gap: space.md,
    maxHeight: '80%',
  },
  handle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.hairlineHi,
    alignSelf: 'center',
  },
  title: { fontSize: 16, fontWeight: '700', color: colors.text },
  list: { gap: space.sm },
  emptyHint: {
    fontSize: 12.5,
    color: colors.textTertiary,
    paddingVertical: space.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.hairline,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: 12,
    marginBottom: space.sm,
  },
  rowName: { fontSize: 14, fontWeight: '600', color: colors.text },
  rowHost: {
    fontFamily: font.mono,
    fontSize: 11,
    color: colors.textTertiary,
    marginTop: 2,
  },
  chevron: { fontSize: 16, color: colors.textTertiary },
  newBrokerRow: {
    borderColor: colors.hairline,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: radius.md,
    padding: 13,
    alignItems: 'center',
  },
  newBrokerText: { fontSize: 13, fontWeight: '600', color: colors.accent },
  actions: { flexDirection: 'row', gap: space.sm },
  primaryBtn: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 13,
  },
  primaryText: { fontSize: 14, fontWeight: '700', color: colors.bg },
  ghostBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: colors.hairline,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: 13,
    paddingHorizontal: 16,
  },
  ghostText: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
});
