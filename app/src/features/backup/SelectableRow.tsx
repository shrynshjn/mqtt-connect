import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, font, radius, space } from '../../ui/theme';

export function SelectableRow({
  title,
  subtitle,
  meta,
  selected,
  onToggle,
  disabled,
}: {
  title: string;
  subtitle?: string;
  meta?: string;
  selected: boolean;
  onToggle: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onToggle}
      disabled={disabled}
      style={[styles.row, disabled && styles.rowDisabled]}
    >
      <View style={[styles.checkbox, selected && styles.checkboxOn]}>
        {selected && <Text style={styles.checkmark}>✓</Text>}
      </View>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle && (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        )}
      </View>
      {meta && <Text style={styles.meta}>{meta}</Text>}
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
    padding: space.md,
    marginBottom: space.xs,
  },
  rowDisabled: { opacity: 0.5 },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.hairlineHi,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  checkmark: { color: colors.bg, fontSize: 13, fontWeight: '700', lineHeight: 14 },
  body: { flex: 1, gap: 2 },
  title: { fontSize: 14, fontWeight: '600', color: colors.text },
  subtitle: { fontFamily: font.mono, fontSize: 11, color: colors.textTertiary },
  meta: { fontFamily: font.mono, fontSize: 10.5, color: colors.textSecondary },
});
