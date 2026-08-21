import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, font, radius } from '../../ui/theme';

export function TopicSuggestionChips({
  suggestions,
  onPick,
}: {
  suggestions: string[];
  onPick: (topic: string) => void;
}) {
  if (suggestions.length === 0) return null;
  return (
    <View style={styles.row}>
      {suggestions.map(s => (
        <Pressable key={s} onPress={() => onPick(s)} style={styles.chip}>
          <Text style={styles.text} numberOfLines={1}>
            {s}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.hairline,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  text: {
    fontFamily: font.mono,
    fontSize: 10.5,
    color: colors.textSecondary,
    maxWidth: 220,
  },
});
