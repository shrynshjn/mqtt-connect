import React, { useEffect } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../app/navigation';
import { colors, font, radius, space } from '../../ui/theme';
import { useProfilesStore } from '../../state/profilesStore';
import { useConnectionsStore } from '../../state/connectionsStore';
import { ConnectionCard } from './ConnectionCard';

type Props = NativeStackScreenProps<RootStackParamList, 'Hub'>;

export function HubScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const profiles = useProfilesStore(s => s.profiles);
  const load = useProfilesStore(s => s.load);
  const snapshots = useConnectionsStore(s => s.snapshots);
  const connect = useConnectionsStore(s => s.connect);
  const disconnect = useConnectionsStore(s => s.disconnect);

  useEffect(() => {
    load();
  }, [load]);

  const liveCount = profiles.filter(p => snapshots[p.id]?.status === 'connected').length;
  const subCount = profiles.reduce((acc, p) => acc + (snapshots[p.id]?.subscriptions.length ?? 0), 0);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Connections</Text>
        <Pressable onPress={() => navigation.navigate('Settings')} hitSlop={10}>
          <Text style={styles.gear}>⚙︎</Text>
        </Pressable>
      </View>
      <Text style={styles.summary}>
        {liveCount} live · {subCount} subscriptions · {profiles.length} profile{profiles.length === 1 ? '' : 's'}
      </Text>

      <FlatList
        contentContainerStyle={styles.list}
        data={profiles}
        keyExtractor={p => p.id}
        renderItem={({ item }) => (
          <ConnectionCard
            profile={item}
            snapshot={snapshots[item.id]}
            onOpen={() => navigation.navigate('Workspace', { profileId: item.id })}
            onToggleConnect={() => (snapshots[item.id]?.status === 'connected' ? disconnect(item.id) : connect(item.id))}
            onEdit={() => navigation.navigate('ProfileForm', { profileId: item.id })}
          />
        )}
        ListFooterComponent={
          <>
            <Pressable style={styles.addRow} onPress={() => navigation.navigate('ProfileForm', {})}>
              <Text style={styles.addText}>Add broker profile</Text>
            </Pressable>
            <Text style={styles.footerNote}>Stored on device · encrypted at rest{'\n'}no cloud sync</Text>
          </>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.lg, paddingTop: space.sm },
  title: { fontSize: 28, fontWeight: '700', color: colors.text },
  gear: { fontSize: 20, color: colors.textSecondary },
  summary: { fontFamily: font.mono, fontSize: 11, color: colors.textTertiary, paddingHorizontal: space.lg, paddingTop: 4, paddingBottom: space.md },
  list: { paddingHorizontal: space.md, paddingBottom: space.xxl },
  addRow: { borderColor: colors.hairline, borderWidth: 1, borderStyle: 'dashed', borderRadius: radius.xl, padding: space.lg, alignItems: 'center' },
  addText: { color: colors.textTertiary, fontSize: 13 },
  footerNote: { fontFamily: font.mono, fontSize: 10, color: colors.textTertiary, textAlign: 'center', paddingTop: space.sm, lineHeight: 16 },
});
