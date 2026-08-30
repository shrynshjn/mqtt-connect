import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { colors, font, radius, space } from './theme';

/** Same non-Modal-overlay approach as LocalPasswordPrompt (see that file for the full
 * explanation) — for a single plain text/number field instead of a password. Use this
 * (not the global showPrompt()/PromptModalHost) for any text entry triggered from a
 * screen that has `presentation: 'modal'` in navigation.tsx. */
export function LocalTextPrompt({
  visible,
  title,
  message,
  initialValue = '',
  keyboardType,
  onCancel,
  onSubmit,
}: {
  visible: boolean;
  title: string;
  message?: string;
  initialValue?: string;
  keyboardType?: 'default' | 'numeric' | 'number-pad';
  onCancel: () => void;
  onSubmit: (value: string) => void;
}) {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    if (visible) setValue(initialValue);
  }, [visible, initialValue]);

  if (!visible) return null;

  return (
    <KeyboardAvoidingView
      style={styles.fill}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      pointerEvents="box-none"
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          {message && <Text style={styles.message}>{message}</Text>}
          <TextInput
            value={value}
            onChangeText={setValue}
            autoFocus
            keyboardType={keyboardType}
            placeholderTextColor={colors.textTertiary}
            style={styles.input}
          />
          <View style={styles.actions}>
            <Pressable style={styles.cancelBtn} onPress={onCancel}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable style={styles.okBtn} onPress={() => onSubmit(value)}>
              <Text style={styles.okText}>OK</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(4,7,13,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.xl,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: colors.surface,
    borderColor: colors.hairlineHi,
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: space.lg,
    gap: space.md,
  },
  title: { fontSize: 15, fontWeight: '700', color: colors.text },
  message: { fontSize: 12.5, color: colors.textSecondary, lineHeight: 18 },
  input: {
    backgroundColor: colors.bg,
    borderColor: colors.hairline,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    fontFamily: font.mono,
    fontSize: 13,
  },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: space.sm },
  cancelBtn: { paddingVertical: 9, paddingHorizontal: 14 },
  cancelText: { fontSize: 14, color: colors.textSecondary },
  okBtn: {
    paddingVertical: 9,
    paddingHorizontal: 14,
    backgroundColor: colors.accentDim,
    borderRadius: radius.sm,
  },
  okText: { fontSize: 14, fontWeight: '600', color: colors.accent },
});
