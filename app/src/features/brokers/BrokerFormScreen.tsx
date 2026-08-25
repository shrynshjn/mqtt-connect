import React, { useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../app/navigation';
import { colors, space } from '../../ui/theme';
import {
  getBroker,
  newBrokerId,
  saveBroker,
  deleteBroker,
} from '../../storage/brokerRepo';
import { clientsUsingBroker } from '../../storage/profileRepo';
import { KeyboardAvoidingScreen } from '../../ui/KeyboardAvoidingScreen';
import { BrokerFields, type BrokerDraft } from './BrokerFields';

type Props = NativeStackScreenProps<RootStackParamList, 'BrokerForm'>;

export function BrokerFormScreen({ route, navigation }: Props) {
  const existing = route.params.brokerId
    ? getBroker(route.params.brokerId)
    : undefined;
  const [draft, setDraft] = useState<BrokerDraft>({
    name: existing?.name ?? '',
    host: existing?.host ?? '',
    port: String(existing?.port ?? 8883),
    transport: existing?.transport ?? 'tls',
  });

  function onSave() {
    if (!draft.name.trim() || !draft.host.trim()) {
      Alert.alert('Missing details', 'Name and host are required.');
      return;
    }
    const now = new Date().toISOString();
    saveBroker({
      id: existing?.id ?? newBrokerId(),
      name: draft.name.trim(),
      host: draft.host.trim(),
      port: Number(draft.port) || 8883,
      transport: draft.transport,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    });
    navigation.goBack();
  }

  function onDelete() {
    if (!existing) return;
    const inUse = clientsUsingBroker(existing.id);
    if (inUse.length > 0) {
      Alert.alert(
        'Broker in use',
        `${inUse.length} client${inUse.length === 1 ? '' : 's'} still use this broker (${inUse.map(c => c.name).join(', ')}). Delete or reassign ${inUse.length === 1 ? 'it' : 'them'} first.`,
      );
      return;
    }
    Alert.alert(
      'Delete broker',
      `Delete "${existing.name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteBroker(existing.id);
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
          {existing ? 'Edit broker' : 'New broker'}
        </Text>
        <Pressable onPress={onSave}>
          <Text style={styles.save}>Save</Text>
        </Pressable>
      </View>

      <KeyboardAvoidingScreen>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <BrokerFields draft={draft} onChange={setDraft} />

          {existing && (
            <Pressable style={styles.deleteBtn} onPress={onDelete}>
              <Text style={styles.deleteText}>Delete broker</Text>
            </Pressable>
          )}
        </ScrollView>
      </KeyboardAvoidingScreen>
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
  deleteBtn: {
    alignItems: 'center',
    borderColor: colors.faultBorder,
    borderWidth: 1,
    borderRadius: 13,
    paddingVertical: 13,
  },
  deleteText: { fontSize: 14, fontWeight: '600', color: colors.fault },
});
