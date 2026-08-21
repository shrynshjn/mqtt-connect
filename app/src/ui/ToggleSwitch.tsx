import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { colors } from './theme';

export function ToggleSwitch({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <Pressable onPress={() => onChange(!value)} style={[styles.track, value && styles.trackOn]}>
      <View style={[styles.thumb, value && styles.thumbOn]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    width: 42,
    height: 25,
    borderRadius: 13,
    padding: 2,
    backgroundColor: colors.hairline,
    justifyContent: 'center',
  },
  trackOn: {
    backgroundColor: colors.accent,
  },
  thumb: {
    width: 21,
    height: 21,
    borderRadius: 11,
    backgroundColor: colors.text,
  },
  thumbOn: {
    alignSelf: 'flex-end',
  },
});
