import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, font, radius, space } from './theme';

export function SegmentedControl<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.track}>
      {options.map(opt => {
        const active = opt.value === value;
        return (
          <Pressable
            key={String(opt.value)}
            onPress={() => onChange(opt.value)}
            style={[styles.segment, active && styles.segmentActive]}
          >
            <Text style={[styles.label, active && styles.labelActive]}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    backgroundColor: colors.bg,
    borderColor: colors.hairline,
    borderWidth: 1,
    borderRadius: radius.sm,
    padding: 2,
    gap: 2,
  },
  segment: {
    paddingVertical: 6,
    paddingHorizontal: space.md,
    borderRadius: radius.sm - 2,
    alignItems: 'center',
  },
  segmentActive: {
    backgroundColor: colors.accent,
  },
  label: {
    fontFamily: font.mono,
    fontSize: 11.5,
    color: colors.textSecondary,
  },
  labelActive: {
    color: colors.bg,
  },
});
