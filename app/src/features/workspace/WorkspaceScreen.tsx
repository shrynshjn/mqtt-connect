import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../app/navigation';
import { colors, font, space } from '../../ui/theme';
import { useProfilesStore } from '../../state/profilesStore';
import {
  useConnectionsStore,
  selectSnapshot,
} from '../../state/connectionsStore';
import { WorkspaceHeader } from './WorkspaceHeader';
import { FeedTab } from '../feed/FeedTab';
import { TopicsTab } from '../topics/TopicsTab';
import { PublishTab } from '../publish/PublishTab';

type Props = NativeStackScreenProps<RootStackParamList, 'Workspace'>;
type TabKey = 'feed' | 'topics' | 'publish';

export function WorkspaceScreen({ route, navigation }: Props) {
  const { profileId } = route.params;
  const insets = useSafeAreaInsets();
  const profile = useProfilesStore(s =>
    s.profiles.find(p => p.id === profileId),
  );
  const snapshot = useConnectionsStore(selectSnapshot(profileId));
  const connect = useConnectionsStore(s => s.connect);
  const disconnect = useConnectionsStore(s => s.disconnect);

  const [tab, setTab] = useState<TabKey>('feed');
  const [prefill, setPrefill] = useState<{
    topic: string;
    payload: string;
  } | null>(null);

  useEffect(() => {
    if (prefill) setTab('publish');
  }, [prefill]);

  if (!profile) return null;

  const tabs: { key: TabKey; label: string; meta: string }[] = [
    { key: 'feed', label: 'Feed', meta: `${snapshot?.counters.rx ?? 0} msgs` },
    {
      key: 'topics',
      label: 'Topics',
      meta: `${snapshot?.subscriptions.length ?? 0} active`,
    },
    { key: 'publish', label: 'Publish', meta: '' },
  ];

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <WorkspaceHeader
        profile={profile}
        snapshot={snapshot}
        onBack={() => navigation.goBack()}
        onToggleConnect={() =>
          snapshot?.status === 'connected'
            ? disconnect(profileId)
            : connect(profileId)
        }
        onEditCert={() => navigation.navigate('ProfileForm', { profileId })}
      />

      <View style={styles.body}>
        {tab === 'feed' && (
          <FeedTab
            profileId={profileId}
            onEditMessage={(topic, payload) => setPrefill({ topic, payload })}
          />
        )}
        {tab === 'topics' && <TopicsTab profileId={profileId} />}
        {tab === 'publish' && (
          <PublishTab
            profileId={profileId}
            prefillTopic={prefill?.topic}
            prefillPayload={prefill?.payload}
          />
        )}
      </View>

      <View
        style={[
          styles.tabBar,
          { paddingBottom: Math.max(insets.bottom, space.sm) },
        ]}
      >
        {tabs.map(t => (
          <Pressable
            key={t.key}
            style={styles.tabItem}
            onPress={() => {
              setPrefill(null);
              setTab(t.key);
            }}
          >
            <View
              style={[
                styles.tabBarIndicator,
                tab === t.key && styles.tabBarIndicatorActive,
              ]}
            />
            <Text
              style={[styles.tabLabel, tab === t.key && styles.tabLabelActive]}
            >
              {t.label}
            </Text>
            {!!t.meta && <Text style={styles.tabMeta}>{t.meta}</Text>}
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  body: { flex: 1 },
  tabBar: {
    flexDirection: 'row',
    borderTopColor: colors.hairline,
    borderTopWidth: 1,
    backgroundColor: '#0C1220',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 11,
    paddingBottom: 9,
    gap: 5,
  },
  tabBarIndicator: {
    height: 2,
    width: 24,
    borderRadius: 1,
    backgroundColor: 'transparent',
  },
  tabBarIndicatorActive: { backgroundColor: colors.accent },
  tabLabel: { fontSize: 12.5, fontWeight: '600', color: colors.textSecondary },
  tabLabelActive: { color: colors.text },
  tabMeta: { fontFamily: font.mono, fontSize: 9.5, color: colors.textTertiary },
});
