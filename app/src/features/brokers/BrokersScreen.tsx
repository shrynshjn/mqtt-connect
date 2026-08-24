import React, { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../app/navigation';
import { colors, font, radius, space } from '../../ui/theme';
import { schemeFor } from '../../types/profile';
import { listBrokers } from '../../storage/brokerRepo';
import { clientsUsingBroker } from '../../storage/profileRepo';
import type { Broker } from '../../types/broker';

type Props = NativeStackScreenProps<RootStackParamList, 'Brokers'>;

export function BrokersScreen({ navigation }: Props) {
  const [brokers, setBrokers] = useState<Broker[]>([]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () =>
      setBrokers(listBrokers()),
    );
    return unsubscribe;
  }, [navigation]);

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </Pressable>
        <Text style={styles.title}>Brokers</Text>
      </View>

      <FlatList
        contentContainerStyle={styles.list}
        data={brokers}
        keyExtractor={b => b.id}
        renderItem={({ item }) => {
          const clientCount = clientsUsingBroker(item.id).length;
          return (
            <Pressable
              style={styles.row}
              onPress={() =>
                navigation.navigate('BrokerForm', { brokerId: item.id })
              }
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.rowName}>{item.name}</Text>
                <Text style={styles.rowHost}>
                  {schemeFor(item.transport)}://{item.host}:{item.port}
                </Text>
                <Text style={styles.rowMeta}>
                  {clientCount} client{clientCount === 1 ? '' : 's'}
                </Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <Text style={styles.emptyHint}>
            No saved brokers yet — add one from a client's form.
          </Text>
        }
        ListFooterComponent={
          <Pressable
            style={styles.addRow}
            onPress={() => navigation.navigate('BrokerForm', {})}
          >
            <Text style={styles.addText}>+ Add broker</Text>
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
  list: { padding: space.md, gap: space.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surface,
    borderColor: colors.hairline,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: space.md,
    marginBottom: space.sm,
  },
  rowName: { fontSize: 15, fontWeight: '600', color: colors.text },
  rowHost: {
    fontFamily: font.mono,
    fontSize: 11,
    color: colors.textTertiary,
    marginTop: 2,
  },
  rowMeta: {
    fontFamily: font.mono,
    fontSize: 10,
    color: colors.textTertiary,
    marginTop: 4,
  },
  chevron: { fontSize: 16, color: colors.textTertiary },
  emptyHint: {
    fontSize: 12.5,
    color: colors.textTertiary,
    textAlign: 'center',
    paddingVertical: space.xl,
  },
  addRow: {
    borderColor: colors.hairline,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: radius.xl,
    padding: space.lg,
    alignItems: 'center',
  },
  addText: { color: colors.textTertiary, fontSize: 13 },
});
