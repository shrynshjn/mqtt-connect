import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, font, radius } from '../../ui/theme';
import { formatRelative } from '../../ui/format';

export function ActiveSubscriptionRow({
  topic,
  qos,
  count,
  onUnsub,
}: {
  topic: string;
  qos: number;
  count: number;
  onUnsub: () => void;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.liveDot} />
      <View style={styles.body}>
        <Text style={styles.topic} numberOfLines={1}>
          {topic}
        </Text>
        <Text style={styles.meta}>
          QoS {qos} · {count} msgs
        </Text>
      </View>
      <Pressable onPress={onUnsub} style={styles.btn}>
        <Text style={styles.btnText}>Unsub</Text>
      </Pressable>
    </View>
  );
}

export function SavedTopicRow({
  topic,
  lastUsedAt,
  onSubscribe,
}: {
  topic: string;
  lastUsedAt: number;
  onSubscribe: () => void;
}) {
  return (
    <Pressable onPress={onSubscribe} style={[styles.row, styles.savedRow]}>
      <View style={styles.hollowDot} />
      <View style={styles.body}>
        <Text style={[styles.topic, styles.savedTopic]} numberOfLines={1}>
          {topic}
        </Text>
        <Text style={styles.meta}>last used {formatRelative(lastUsedAt)}</Text>
      </View>
      <Text style={styles.subscribeText}>Subscribe</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    backgroundColor: colors.surface,
    borderColor: colors.hairline,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: 12,
  },
  savedRow: { backgroundColor: '#0F1421' },
  body: { flex: 1, gap: 3 },
  topic: { fontFamily: font.mono, fontSize: 12, color: colors.text },
  savedTopic: { color: colors.textSecondary },
  meta: { fontFamily: font.mono, fontSize: 10, color: colors.textTertiary },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
  hollowDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: colors.textTertiary,
  },
  btn: {
    borderColor: colors.hairline,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  btnText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  subscribeText: { fontSize: 12, fontWeight: '600', color: colors.accent },
});
