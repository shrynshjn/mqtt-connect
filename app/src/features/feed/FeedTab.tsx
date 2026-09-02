import React, { useMemo, useReducer, useState } from 'react';
import { Buffer } from 'buffer';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Share from 'react-native-share';
import {
  writeFile,
  unlink,
  CachesDirectoryPath,
} from '@dr.pogodin/react-native-fs';
import { colors, font, space } from '../../ui/theme';
import { KeyboardAvoidingScreen } from '../../ui/KeyboardAvoidingScreen';
import { useMessages } from '../../state/useMessages';
import { useConnectionsStore } from '../../state/connectionsStore';
import { useToast } from '../../ui/Toast';
import { FeedRow } from './FeedRow';
import { SnippetStrip } from './SnippetStrip';
import { MessageDetailSheet } from './MessageDetailSheet';
import { getSnippets, removeSnippet } from '../../storage/snippetRepo';
import { getProfile } from '../../storage/profileRepo';
import type { ProfileId } from '../../types/profile';
import type { MqttMessage, Snippet } from '../../types/message';

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
  const [exporting, setExporting] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detailMessage, setDetailMessage] = useState<MqttMessage | null>(null);
  // Not reactive state on purpose — a new snippet pinned from the Publish tab shows up
  // because WorkspaceScreen unmounts/remounts tabs on switch, which re-runs this.
  // Unpinning forces a re-render itself (see `unpin` below), so it doesn't need that.
  const [, forceSnippetsRefresh] = useReducer(n => n + 1, 0);
  const snippets = getSnippets(profileId);

  function unpin(s: Snippet) {
    removeSnippet(profileId, s.id);
    forceSnippetsRefresh();
    show('unpinned');
  }

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

  async function exportFeed() {
    if (exporting) return;
    if (allMessages.length === 0) {
      show('no messages to export');
      return;
    }
    setExporting(true);
    let tempPath: string | undefined;
    try {
      const rows = allMessages.map(m => ({
        direction: m.direction,
        topic: m.topic,
        payload: Buffer.from(m.payload).toString('utf8'),
        qos: m.qos,
        retain: m.retain,
        receivedAt: new Date(m.receivedAt).toISOString(),
      }));
      const json = JSON.stringify(rows, null, 2);

      const profile = getProfile(profileId);
      const slug =
        (profile?.name ?? 'feed')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '') || 'feed';
      const filename = `mqtt-connect-feed-${slug}-${new Date()
        .toISOString()
        .replace(/[:.]/g, '-')}.json`;
      tempPath = `${CachesDirectoryPath}/${filename}`;
      await writeFile(tempPath, json, 'utf8');

      const result = await Share.open({
        url: `file://${tempPath}`,
        type: 'application/json',
        filename,
        failOnCancel: false,
      });
      if (!result.dismissedAction) show('feed exported');
    } catch (e) {
      show(`export failed · ${(e as Error).message}`);
    } finally {
      if (tempPath) unlink(tempPath).catch(() => {});
      setExporting(false);
    }
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
    <KeyboardAvoidingScreen style={styles.root}>
      <SnippetStrip
        snippets={snippets}
        onAdd={() => onEditMessage('', '')}
        onRemove={unpin}
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
        <Pressable
          onPress={exportFeed}
          disabled={exporting || allMessages.length === 0}
          style={[
            styles.exportBtn,
            (exporting || allMessages.length === 0) && styles.dimmed,
          ]}
          hitSlop={8}
        >
          {exporting ? (
            <ActivityIndicator size="small" color={colors.textSecondary} />
          ) : (
            <Text style={styles.exportText}>⇩ EXPORT</Text>
          )}
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
    </KeyboardAvoidingScreen>
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
  exportBtn: {
    borderColor: colors.hairline,
    borderWidth: 1,
    borderRadius: 9,
    paddingVertical: 8,
    paddingHorizontal: 10,
    minWidth: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exportText: {
    fontFamily: font.mono,
    fontSize: 10.5,
    letterSpacing: 0.5,
    color: colors.textSecondary,
  },
  dimmed: { opacity: 0.4 },
  list: { flex: 1, borderTopColor: colors.hairline, borderTopWidth: 1 },
  empty: { padding: 60, alignItems: 'center' },
  emptyTitle: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
});
