import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { colors, font, radius, space } from './theme';

interface PromptState {
  title: string;
  message?: string;
  secure?: boolean;
  multiline?: boolean;
  resolve: (value: string | null) => void;
}

let setter: ((s: PromptState | null) => void) | null = null;

/** Cross-platform stand-in for iOS-only `Alert.prompt` — Android has no built-in
 * equivalent, and this app's cert-import flow (bundle passwords, pasted PEM text)
 * needs one on both platforms. Mount <PromptModalHost/> once near the app root, then
 * call `showPrompt(...)` from anywhere. */
export function showPrompt(
  title: string,
  message?: string,
  opts: { secure?: boolean; multiline?: boolean } = {},
): Promise<string | null> {
  return new Promise(resolve => {
    setter?.({
      title,
      message,
      secure: opts.secure,
      multiline: opts.multiline,
      resolve,
    });
  });
}

export function PromptModalHost() {
  const [state, setState] = useState<PromptState | null>(null);
  const [value, setValue] = useState('');
  setter = setState;

  function close(result: string | null) {
    state?.resolve(result);
    setState(null);
    setValue('');
  }

  if (!state) return null;

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={() => close(null)}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.backdrop}>
          <View style={styles.card}>
            <Text style={styles.title}>{state.title}</Text>
            {state.message && (
              <Text style={styles.message}>{state.message}</Text>
            )}
            <TextInput
              value={value}
              onChangeText={setValue}
              secureTextEntry={state.secure}
              multiline={state.multiline}
              autoFocus
              style={[styles.input, state.multiline && styles.inputMultiline]}
              placeholderTextColor={colors.textTertiary}
            />
            <View style={styles.actions}>
              <Pressable style={styles.cancelBtn} onPress={() => close(null)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.okBtn} onPress={() => close(value)}>
                <Text style={styles.okText}>OK</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
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
  inputMultiline: { minHeight: 100, textAlignVertical: 'top' },
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
