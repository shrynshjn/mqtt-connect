import React, { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { colors, font, radius, space } from '../../ui/theme';
import { useToast } from '../../ui/Toast';
import { stripSmartPunctuation } from '../../ui/sanitizeText';
import {
  useConnectionsStore,
  selectSnapshot,
} from '../../state/connectionsStore';
import { getSavedTopics } from '../../storage/subscriptionRepo';
import { suggestTopics } from '../../topics/topicSuggestions';
import { isValidSubscriptionFilter } from '../../mqtt/topicMatch';
import { SegmentedControl } from '../../ui/SegmentedControl';
import { TopicSuggestionChips } from './TopicSuggestionChips';
import { ActiveSubscriptionRow, SavedTopicRow } from './SubscriptionRow';
import type { ProfileId, QoS } from '../../types/profile';

export function TopicsTab({ profileId }: { profileId: ProfileId }) {
  const snapshot = useConnectionsStore(selectSnapshot(profileId));
  const subscribeTopic = useConnectionsStore(s => s.subscribeTopic);
  const unsubscribeTopic = useConnectionsStore(s => s.unsubscribeTopic);
  const show = useToast();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const [qos, setQos] = useState<QoS>(0);
  const [savedTopics, setSavedTopics] = useState(() =>
    getSavedTopics(profileId),
  );

  const active = snapshot?.subscriptions ?? [];
  const suggestions = suggestTopics(profileId, draft).filter(
    t => !active.some(a => a.filter === t),
  );

  function refreshSaved() {
    setSavedTopics(getSavedTopics(profileId));
  }

  function commit() {
    const topic = draft.trim();
    if (!isValidSubscriptionFilter(topic)) {
      show('subscribe failed · invalid topic filter');
      return;
    }
    const result = subscribeTopic(profileId, topic, qos);
    if (!result.ok) {
      show(`subscribe failed · ${result.error}`);
      return;
    }
    setAdding(false);
    setDraft('');
    refreshSaved();
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.sectionLabel}>Active subscriptions</Text>
      {active.length === 0 && (
        <Text style={styles.emptyHint}>No active subscriptions yet.</Text>
      )}
      {active.map(s => (
        <ActiveSubscriptionRow
          key={s.filter}
          topic={s.filter}
          qos={s.requestedQos}
          count={s.messageCount}
          onUnsub={() => {
            unsubscribeTopic(profileId, s.filter);
            refreshSaved();
          }}
        />
      ))}

      <Text style={styles.sectionLabel}>Saved for this broker</Text>
      {savedTopics.map(s => (
        <SavedTopicRow
          key={s.topic}
          topic={s.topic}
          lastUsedAt={s.lastUsedAt}
          onSubscribe={() => {
            const result = subscribeTopic(profileId, s.topic, 0);
            if (!result.ok) show(`subscribe failed · ${result.error}`);
            refreshSaved();
          }}
        />
      ))}

      {adding ? (
        <View style={styles.addBox}>
          <Text style={styles.sectionLabel}>New subscription</Text>
          <TextInput
            value={draft}
            onChangeText={v => setDraft(stripSmartPunctuation(v))}
            placeholder="factory/line-2/#"
            placeholderTextColor={colors.textTertiary}
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            style={styles.input}
            autoFocus
          />
          <TopicSuggestionChips suggestions={suggestions} onPick={setDraft} />
          <View style={styles.qosRow}>
            <Text style={styles.qosLabel}>QoS</Text>
            <SegmentedControl
              options={[
                { value: 0, label: '0' },
                { value: 1, label: '1' },
                { value: 2, label: '2' },
              ]}
              value={qos}
              onChange={setQos}
            />
          </View>
          <View style={styles.actions}>
            <Pressable style={styles.primaryBtn} onPress={commit}>
              <Text style={styles.primaryText}>Subscribe</Text>
            </Pressable>
            <Pressable style={styles.ghostBtn} onPress={() => setAdding(false)}>
              <Text style={styles.ghostText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable style={styles.newRow} onPress={() => setAdding(true)}>
          <Text style={styles.newRowText}>New subscription</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: space.md, gap: space.sm },
  sectionLabel: {
    fontFamily: font.mono,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.textTertiary,
    marginTop: space.sm,
  },
  emptyHint: { fontSize: 12.5, color: colors.textTertiary },
  addBox: {
    backgroundColor: colors.surface,
    borderColor: colors.hairlineHi,
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: 13,
    gap: 10,
  },
  input: {
    backgroundColor: colors.bg,
    borderColor: colors.hairline,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontFamily: font.mono,
    fontSize: 13,
    color: colors.text,
  },
  qosRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  qosLabel: {
    fontFamily: font.mono,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.textTertiary,
  },
  actions: { flexDirection: 'row', gap: 9 },
  primaryBtn: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: 11,
    paddingVertical: 12,
  },
  primaryText: { fontSize: 14, fontWeight: '700', color: colors.bg },
  ghostBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: colors.hairline,
    borderWidth: 1,
    borderRadius: 11,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  ghostText: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
  newRow: {
    borderColor: colors.hairline,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: radius.md,
    padding: 14,
    alignItems: 'center',
  },
  newRowText: { fontSize: 13, color: colors.textTertiary },
});
