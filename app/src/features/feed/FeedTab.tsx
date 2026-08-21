import React, { useMemo, useState } from 'react';
import { Buffer } from 'buffer';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { colors, font, space } from '../../ui/theme';
import { useMessages } from '../../state/useMessages';
import { useConnectionsStore } from '../../state/connectionsStore';
import { useToast } from '../../ui/Toast';
import { FeedRow } from './FeedRow';
import { SnippetStrip } from './SnippetStrip';
import { MessageDetailSheet } from './MessageDetailSheet';
import { getSnippets } from '../../storage/snippetRepo';
import type { ProfileId } from '../../types/profile';
import type { MqttMessage } from '../../types/message';

export function FeedTab({
  profileId,
  onEditMessage,
}: {
  profileId: ProfileId;
  onEditMessage: (topic: string, payload: string) => void;
}) {
  const allMessages = useMessages(profileId);
  const publish = useConnectionsStore(s => s.publish);
  const clearMessages = useConnectionsStore(s => s.clearMessages);
  const show = useToast();
  const [filter, setFilter] = useState('');
  const [paused, setPaused] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detailMessage, setDetailMessage] = useState<MqttMessage | null>(null);
  // Not reactive state on purpose — a new snippet pinned from the Publish tab shows up
  // because WorkspaceScreen unmounts/remounts tabs on switch, which re-runs this.
  const snippets = getSnippets(profileId);

  const messages = useMemo(() => {
    const list = paused ? allMessages : allMessages;
    const q = filter.trim().toLowerCase();
    const filtered = q
      ? list.filter(
          m =>
            m.topic.toLowerCase().includes(q) ||
            Buffer.from(m.payload).toString('utf8').toLowerCase().includes(q),
        )
      : list;
    return [...filtered].reverse();
  }, [allMessages, filter, paused]);

  function onClear() {
    clearMessages(profileId);
    setExpandedId(null);
    setDetailMessage(null);
    show('log cleared');
  }

  function resend(m: MqttMessage) {
    const result = publish({
      profileId,
      topic: m.topic,
      payload: Buffer.from(m.payload).toString('utf8'),
      qos: m.qos,
      retain: m.retain,
    });
    show(
      result.ok ? `published → ${m.topic}` : `publish failed · ${result.error}`,
    );
  }

  return (
    <View style={styles.root}>
      <SnippetStrip
        snippets={snippets}
        onAdd={() => onEditMessage('', '')}
        onFire={s => {
          const result = publish({
            profileId,
            topic: s.topic,
            payload: s.payload,
            qos: s.qos,
            retain: s.retain,
          });
          show(
            result.ok
              ? `published → ${s.topic}`
              : `publish failed · ${result.error}`,
          );
        }}
      />

      <View style={styles.toolRow}>
        <TextInput
          value={filter}
          onChangeText={setFilter}
          placeholder="Filter topic or payload"
          placeholderTextColor={colors.textTertiary}
          style={styles.filterInput}
        />
        <Pressable onPress={() => setPaused(p => !p)} style={styles.pauseBtn}>
          <Text style={[styles.pauseText, paused && { color: colors.fault }]}>
            {paused ? 'PAUSED' : 'LIVE'}
          </Text>
        </Pressable>
        <Pressable onPress={onClear} style={styles.clearBtn} hitSlop={8}>
          <Text style={styles.clearText}>⌫ CLEAR</Text>
        </Pressable>
      </View>

      <FlatList
        style={styles.list}
        data={messages}
        keyExtractor={m => m.id}
        renderItem={({ item }) => (
          <FeedRow
            message={item}
            expanded={expandedId === item.id}
            onToggle={() =>
              setExpandedId(id => (id === item.id ? null : item.id))
            }
            onResend={() => resend(item)}
            onEdit={() =>
              onEditMessage(
                item.topic,
                Buffer.from(item.payload).toString('utf8'),
              )
            }
            onCopy={() => show('payload copied')}
            onDetail={() => setDetailMessage(item)}
          />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>
              {filter ? 'No matching messages' : 'Waiting for messages'}
            </Text>
          </View>
        }
      />

      <MessageDetailSheet
        message={detailMessage}
        onClose={() => setDetailMessage(null)}
        onResend={m => {
          resend(m);
          setDetailMessage(null);
        }}
        onCopy={() => {
          show('payload copied');
          setDetailMessage(null);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  toolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: space.md,
    paddingBottom: space.sm,
  },
  filterInput: {
    flex: 1,
    backgroundColor: colors.surface,
    borderColor: colors.hairline,
    borderWidth: 1,
    borderRadius: 9,
    paddingHorizontal: 11,
    paddingVertical: 8,
    fontFamily: font.mono,
    fontSize: 11.5,
    color: colors.text,
  },
  pauseBtn: {
    borderColor: colors.hairline,
    borderWidth: 1,
    borderRadius: 9,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  pauseText: {
    fontFamily: font.mono,
    fontSize: 10.5,
    letterSpacing: 0.5,
    color: colors.accent,
  },
  clearBtn: {
    borderColor: colors.hairline,
    borderWidth: 1,
    borderRadius: 9,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  clearText: {
    fontFamily: font.mono,
    fontSize: 10.5,
    letterSpacing: 0.5,
    color: colors.textSecondary,
  },
  list: { flex: 1, borderTopColor: colors.hairline, borderTopWidth: 1 },
  empty: { padding: 60, alignItems: 'center' },
  emptyTitle: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
});
