import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, font, radius, space } from '../../ui/theme';
import type { Snippet } from '../../types/message';

export function SnippetStrip({ snippets, onFire, onAdd }: { snippets: Snippet[]; onFire: (s: Snippet) => void; onAdd: () => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {snippets.map(s => (
        <Pressable key={s.id} onPress={() => onFire(s)} style={styles.chip}>
          <View style={styles.playIcon} />
          <View>
            <Text style={styles.name} numberOfLines={1}>
              {s.name}
            </Text>
            <Text style={styles.topic} numberOfLines={1}>
              {s.topic}
            </Text>
          </View>
        </Pressable>
      ))}
      <Pressable onPress={onAdd} style={styles.addChip}>
        <Text style={styles.addText}>+</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.sm, paddingHorizontal: space.md, paddingVertical: space.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.hairlineHi,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  playIcon: {
    width: 0,
    height: 0,
    borderTopWidth: 4.5,
    borderBottomWidth: 4.5,
    borderLeftWidth: 7,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: colors.accent,
  },
  name: { fontSize: 12.5, fontWeight: '600', color: colors.text, maxWidth: 140 },
  topic: { fontFamily: font.mono, fontSize: 9.5, color: colors.textTertiary, maxWidth: 140 },
  addChip: { width: 34, alignItems: 'center', justifyContent: 'center', borderColor: colors.hairline, borderWidth: 1, borderStyle: 'dashed', borderRadius: radius.pill },
  addText: { color: colors.textTertiary, fontSize: 15 },
});
