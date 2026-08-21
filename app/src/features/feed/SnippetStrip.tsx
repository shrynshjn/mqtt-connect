import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, font, radius, space } from '../../ui/theme';
import type { Snippet } from '../../types/message';

export function SnippetStrip({
  snippets,
  onFire,
  onAdd,
}: {
  snippets: Snippet[];
  onFire: (s: Snippet) => void;
  onAdd: () => void;
}) {
  // With zero snippets, a lone unlabeled "+" glyph reads as a mystery — its meaning
  // only comes across once it sits at the end of a row of real chips. Spell it out
  // until there's something for it to sit next to.
  if (snippets.length === 0) {
    return (
      <Pressable onPress={onAdd} style={styles.emptyRow}>
        <Text style={styles.emptyText}>+ Add a quick-publish shortcut</Text>
      </Pressable>
    );
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroll}
      contentContainerStyle={styles.row}
    >
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
  // Both `scroll` (flexGrow: 0) and `row`'s alignItems matter here: without them, an
  // empty-ish horizontal ScrollView sitting in a flex:1 ancestor has no height of its
  // own to derive from, and a stretch-aligned child with no intrinsic height (addChip,
  // below) will expand to fill whatever space Yoga hands it — which is exactly how a
  // small "+" chip turned into a full-height dashed box.
  scroll: { flexGrow: 0 },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
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
  name: {
    fontSize: 12.5,
    fontWeight: '600',
    color: colors.text,
    maxWidth: 140,
  },
  topic: {
    fontFamily: font.mono,
    fontSize: 9.5,
    color: colors.textTertiary,
    maxWidth: 140,
  },
  addChip: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: colors.hairline,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: radius.pill,
  },
  addText: { color: colors.textTertiary, fontSize: 15 },
  emptyRow: {
    marginHorizontal: space.md,
    marginVertical: space.sm,
    paddingVertical: 10,
    borderColor: colors.hairline,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: radius.pill,
    alignItems: 'center',
  },
  emptyText: { color: colors.textTertiary, fontSize: 12.5 },
});
