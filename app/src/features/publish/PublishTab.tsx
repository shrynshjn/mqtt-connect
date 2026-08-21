import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, font, radius, space } from '../../ui/theme';
import { useConnectionsStore } from '../../state/connectionsStore';
import { useToast } from '../../ui/Toast';
import { SegmentedControl } from '../../ui/SegmentedControl';
import { ToggleSwitch } from '../../ui/ToggleSwitch';
import { TopicSuggestionChips } from '../topics/TopicSuggestionChips';
import { suggestTopics } from '../../topics/topicSuggestions';
import { isValidPublishTopic } from '../../mqtt/topicMatch';
import { addSnippet } from '../../storage/snippetRepo';
import type { ProfileId, QoS } from '../../types/profile';

type Format = 'JSON' | 'Text' | 'Base64';

export function PublishTab({
  profileId,
  prefillTopic,
  prefillPayload,
}: {
  profileId: ProfileId;
  prefillTopic?: string;
  prefillPayload?: string;
}) {
  const publish = useConnectionsStore(s => s.publish);
  const show = useToast();
  const [topic, setTopic] = useState(prefillTopic ?? '');
  const [payload, setPayload] = useState(prefillPayload ?? '');
  const [qos, setQos] = useState<QoS>(0);
  const [retain, setRetain] = useState(false);
  const [format, setFormat] = useState<Format>('JSON');

  useEffect(() => {
    if (prefillTopic != null) setTopic(prefillTopic);
    if (prefillPayload != null) setPayload(prefillPayload);
  }, [prefillTopic, prefillPayload]);

  const suggestions = suggestTopics(profileId, topic);

  function doPublish() {
    if (!isValidPublishTopic(topic.trim())) {
      show('publish failed · invalid topic');
      return;
    }
    const result = publish({ profileId, topic: topic.trim(), payload, qos, retain });
    show(result.ok ? `published → ${topic.trim()}` : `publish failed · ${result.error}`);
  }

  function pin() {
    if (!isValidPublishTopic(topic.trim())) return;
    addSnippet({ profileId, name: topic.trim().split('/').pop() || topic.trim(), topic: topic.trim(), payload, qos, retain });
    show('pinned to feed');
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.section}>
        <Text style={styles.label}>Topic</Text>
        <TextInput
          value={topic}
          onChangeText={setTopic}
          placeholder="factory/line-2/…"
          placeholderTextColor={colors.textTertiary}
          style={styles.topicInput}
        />
        <TopicSuggestionChips suggestions={suggestions} onPick={setTopic} />
      </View>

      <View style={styles.section}>
        <View style={styles.payloadHeader}>
          <Text style={styles.label}>Payload</Text>
          <SegmentedControl
            options={[{ value: 'JSON', label: 'JSON' }, { value: 'Text', label: 'Text' }, { value: 'Base64', label: 'Base64' }]}
            value={format}
            onChange={setFormat}
          />
        </View>
        <TextInput
          value={payload}
          onChangeText={setPayload}
          multiline
          numberOfLines={6}
          style={styles.payloadInput}
          placeholder=""
          placeholderTextColor={colors.textTertiary}
        />
      </View>

      <View style={styles.qosRetainRow}>
        <Text style={styles.label}>QoS</Text>
        <SegmentedControl options={[{ value: 0, label: '0' }, { value: 1, label: '1' }, { value: 2, label: '2' }]} value={qos} onChange={setQos} />
        <View style={{ flex: 1 }} />
        <Text style={styles.retainLabel}>Retain</Text>
        <ToggleSwitch value={retain} onChange={setRetain} />
      </View>

      <View style={styles.actions}>
        <Pressable style={styles.publishBtn} onPress={doPublish}>
          <Text style={styles.publishText}>Publish</Text>
        </Pressable>
        <Pressable style={styles.pinBtn} onPress={pin}>
          <Text style={styles.pinText}>Pin</Text>
        </Pressable>
      </View>
      <Text style={styles.hint}>Pinned messages appear at the top of the feed and send in one tap.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: space.md, gap: space.lg },
  section: { gap: space.sm },
  label: { fontFamily: font.mono, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', color: colors.textTertiary },
  topicInput: { backgroundColor: colors.surface, borderColor: colors.hairlineHi, borderWidth: 1, borderRadius: 11, paddingHorizontal: 13, paddingVertical: 12, fontFamily: font.mono, fontSize: 13, color: colors.text },
  payloadHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  payloadInput: { minHeight: 120, backgroundColor: colors.surface, borderColor: colors.hairline, borderWidth: 1, borderRadius: 11, paddingHorizontal: 13, paddingVertical: 12, fontFamily: font.mono, fontSize: 12, lineHeight: 19, color: colors.text, textAlignVertical: 'top' },
  qosRetainRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  retainLabel: { fontSize: 13, color: colors.textSecondary },
  actions: { flexDirection: 'row', gap: 9 },
  publishBtn: { flex: 1, alignItems: 'center', backgroundColor: colors.accent, borderRadius: radius.md, paddingVertical: 14 },
  publishText: { fontSize: 15, fontWeight: '700', color: colors.bg },
  pinBtn: { alignItems: 'center', justifyContent: 'center', borderColor: colors.hairline, borderWidth: 1, borderRadius: radius.md, paddingVertical: 14, paddingHorizontal: 18 },
  pinText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  hint: { fontFamily: font.mono, fontSize: 10, lineHeight: 16, color: colors.textTertiary },
});
