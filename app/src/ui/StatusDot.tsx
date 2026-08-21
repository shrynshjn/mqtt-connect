import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { colors } from './theme';
import type { ConnectionStatus } from '../types/connection';

export function statusKind(status: ConnectionStatus): 'live' | 'fault' | 'idle' {
  if (status === 'connected') return 'live';
  if (status === 'error') return 'fault';
  return 'idle'; // idle/connecting/reconnecting/disconnecting all render as the "not yet live" hollow dot, animated below
}

export function StatusDot({ status, size = 9 }: { status: ConnectionStatus; size?: number }) {
  const pulsing = status === 'connecting' || status === 'reconnecting';
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!pulsing) {
      opacity.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.35, duration: 550, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 550, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulsing, opacity]);

  const kind = statusKind(status);
  const style = [
    styles.base,
    { width: size, height: size, borderRadius: size / 2 },
    kind === 'live' && { backgroundColor: colors.accent },
    kind === 'fault' && { borderWidth: 1.6, borderColor: colors.fault },
    kind === 'idle' && { borderWidth: 1.6, borderColor: pulsing ? colors.accentMuted : colors.textTertiary },
  ];

  return (
    <Animated.View style={{ opacity: pulsing ? opacity : 1 }}>
      <View style={style} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: 'transparent',
  },
});
