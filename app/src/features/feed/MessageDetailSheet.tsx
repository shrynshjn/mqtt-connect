import React, { useState } from 'react';
import { Buffer } from 'buffer';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors, font, radius, space } from '../../ui/theme';
import { SegmentedControl } from '../../ui/SegmentedControl';
import { formatTimestamp, byteLength } from '../../ui/format';
import type { MqttMessage } from '../../types/message';

type ViewMode = 'JSON' | 'Text' | 'Base64';

function renderBody(payload: Uint8Array, mode: ViewMode): string {
  const text = Buffer.from(payload).toString('utf8');
  if (mode === 'Base64') return Buffer.from(payload).toString('base64');
  if (mode === 'Text') return text;
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}

export function MessageDetailSheet({
  message,
  onClose,
  onResend,
  onCopy,
}: {
  message: MqttMessage | null;
  onClose: () => void;
  onResend: (m: MqttMessage) => void;
  onCopy: (m: MqttMessage) => void;
}) {
  const [mode, setMode] = useState<ViewMode>('JSON');
  if (!message) return null;

  const meta = [
    formatTimestamp(message.receivedAt),
    message.direction === 'out' ? 'outgoing' : 'incoming',
    `QoS ${message.qos}`,
    message.retain ? 'retained' : 'not retained',
    byteLength(message.payload),
  ];

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.handle} />
          <Text style={styles.label}>Message</Text>
          <Text style={styles.topic}>{message.topic}</Text>
          <View style={styles.metaRow}>
            {meta.map(m => (
              <Text key={m} style={styles.metaChip}>
                {m}
              </Text>
            ))}
          </View>
          <SegmentedControl
            options={[
              { value: 'JSON', label: 'JSON' },
              { value: 'Text', label: 'Text' },
              { value: 'Base64', label: 'Base64' },
            ]}
            value={mode}
            onChange={setMode}
          />
          <ScrollView style={styles.payloadBox}>
            <Text style={styles.payloadText}>
              {renderBody(message.payload, mode)}
            </Text>
          </ScrollView>
          <View style={styles.actions}>
            <Pressable
              style={styles.primaryBtn}
              onPress={() => onResend(message)}
            >
              <Text style={styles.primaryText}>Re-send</Text>
            </Pressable>
            <Pressable style={styles.ghostBtn} onPress={() => onCopy(message)}>
              <Text style={styles.ghostText}>Copy</Text>
            </Pressable>
          </View>
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
  },
  handle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.hairlineHi,
    alignSelf: 'center',
  },
  label: {
    fontFamily: font.mono,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.textTertiary,
  },
  topic: { fontFamily: font.mono, fontSize: 13, color: colors.text },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  metaChip: {
    fontFamily: font.mono,
    fontSize: 10,
    color: colors.textSecondary,
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.hairline,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  payloadBox: {
    maxHeight: 230,
    backgroundColor: colors.bg,
    borderColor: colors.hairline,
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: 13,
  },
  payloadText: {
    fontFamily: font.mono,
    fontSize: 11.5,
    lineHeight: 19,
    color: colors.text,
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
});
