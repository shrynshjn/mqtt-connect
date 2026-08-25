import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

/** Wraps screen content so a focused TextInput never ends up hidden behind the
 * on-screen keyboard. Android resizes the window automatically via
 * `windowSoftInputMode="adjustResize"` (AndroidManifest.xml), so only iOS needs the
 * explicit padding behavior by default. Modals run in their own Android window, where
 * adjustResize doesn't apply — pass `behavior="height"` at those call sites. */
export function KeyboardAvoidingScreen({
  children,
  style,
  behavior,
  keyboardVerticalOffset,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  behavior?: 'height' | 'padding' | 'position';
  keyboardVerticalOffset?: number;
}) {
  return (
    <KeyboardAvoidingView
      style={[{ flex: 1 }, style]}
      behavior={behavior ?? (Platform.OS === 'ios' ? 'padding' : undefined)}
      keyboardVerticalOffset={keyboardVerticalOffset}
    >
      {children}
    </KeyboardAvoidingView>
  );
}
