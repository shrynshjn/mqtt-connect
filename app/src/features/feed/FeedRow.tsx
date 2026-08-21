import React from 'react';
import { Buffer } from 'buffer';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, font, space } from '../../ui/theme';
import { formatTimestamp, byteLength } from '../../ui/format';
import type { MqttMessage } from '../../types/message';

function decodePayload(payload: Uint8Array): string {
  try {
    return Buffer.from(payload).toString('utf8');
  } catch {
    return Buffer.from(payload).toString('hex');
  }
}

function prettyPayload(text: string): string {
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}

export function FeedRow({
  message,
  expanded,
  onToggle,
  onResend,
  onEdit,
  onCopy,
  onDetail,
}: {
  message: MqttMessage;
  expanded: boolean;
  onToggle: () => void;
  onResend: () => void;
  onEdit: () => void;
  onCopy: () => void;
  onDetail: () => void;
}) {
  const out = message.direction === 'out';
  const text = decodePayload(message.payload);

  return (
    <Pressable onPress={onToggle} style={[styles.row, out ? styles.rowOut : styles.rowIn]}>
      <View style={styles.headerRow}>
        <Text style={styles.time}>{formatTimestamp(message.receivedAt)}</Text>
        <Text style={[styles.dir, out && styles.dirOut]}>{out ? 'TX' : 'RX'}</Text>
        <Text style={[styles.topic, out && styles.topicOut]} numberOfLines={1}>
          {message.topic}
        </Text>
      </View>

      {expanded && (
        <View style={styles.detail}>
          <View style={styles.tagsRow}>
            <Text style={styles.tag}>Q{message.qos}</Text>
            <Text style={styles.tag}>{message.retain ? 'retained' : 'not retained'}</Text>
            <Text style={styles.tag}>{byteLength(message.payload)}</Text>
          </View>
          <Text style={styles.payload}>{prettyPayload(text)}</Text>
          <View style={styles.actions}>
            <Pressable onPress={onResend} style={styles.actionPrimary}>
              <Text style={styles.actionPrimaryText}>Re-send</Text>
            </Pressable>
            <Pressable onPress={onEdit} style={styles.actionGhost}>
              <Text style={styles.actionGhostText}>Edit & send</Text>
            </Pressable>
            <Pressable onPress={onCopy} style={styles.actionGhost}>
              <Text style={styles.actionGhostText}>Copy</Text>
            </Pressable>
            <Pressable onPress={onDetail} style={styles.actionGhost}>
              <Text style={styles.actionGhostText}>↗</Text>
            </Pressable>
          </View>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { borderBottomColor: colors.rowHairline, borderBottomWidth: 1, paddingLeft: 9, borderLeftWidth: 2 },
  rowIn: { borderLeftColor: colors.accentDim },
  rowOut: { borderLeftColor: colors.accentMuted },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 8, paddingRight: space.md },
  time: { fontFamily: font.mono, fontSize: 10.5, color: colors.textTertiary },
  dir: { fontFamily: font.mono, fontSize: 10, fontWeight: '600', color: colors.accent },
  dirOut: { color: colors.accentMuted },
  topic: { flex: 1, fontFamily: font.mono, fontSize: 11.5, color: colors.text },
  topicOut: { color: colors.accent },
  detail: { paddingBottom: space.md, paddingRight: space.md, gap: 10 },
  tagsRow: { flexDirection: 'row', gap: 6 },
  tag: { fontFamily: font.mono, fontSize: 9.5, color: colors.textSecondary, backgroundColor: colors.surfaceRaised, borderColor: colors.hairline, borderWidth: 1, borderRadius: 5, paddingHorizontal: 6, paddingVertical: 3 },
  payload: { fontFamily: font.mono, fontSize: 11, color: colors.text, backgroundColor: colors.surface, borderColor: colors.hairline, borderWidth: 1, borderRadius: 10, padding: 11 },
  actions: { flexDirection: 'row', gap: 8 },
  actionPrimary: { backgroundColor: colors.accentDim, borderRadius: 8, paddingVertical: 7, paddingHorizontal: 12 },
  actionPrimaryText: { fontSize: 12, fontWeight: '600', color: colors.accent },
  actionGhost: { borderColor: colors.hairline, borderWidth: 1, borderRadius: 8, paddingVertical: 7, paddingHorizontal: 10 },
  actionGhostText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
});
