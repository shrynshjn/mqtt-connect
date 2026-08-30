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

/** Same visual language as PromptModal (see ../ui/PromptModal.tsx), but rendered as a
 * plain absolutely-positioned overlay instead of RN's <Modal>. Any screen registered
 * with `presentation: 'modal'` in navigation.tsx is itself a natively-presented view
 * controller — RN's <Modal> always tries to present from the app's root VC, which by
 * then is already busy presenting that screen's own native-stack modal chain. iOS
 * silently rejects the second presentation (logged as "Attempt to present ... which is
 * already presenting <RNSScreen>"), so the prompt never visibly appears — tapping the
 * button that opens it looks like it does nothing. A plain View, mounted as the last
 * sibling inside the screen's own already-topmost tree, has no such conflict.
 *
 * Use this (not the global showPrompt()/PromptModalHost) for any password/text entry
 * triggered from a screen that has `presentation: 'modal'`. */
export function LocalPasswordPrompt({
  visible,
  title,
  message,
  confirmRequired,
  onCancel,
  onSubmit,
}: {
  visible: boolean;
  title: string;
  message?: string;
  confirmRequired?: boolean;
  onCancel: () => void;
  onSubmit: (password: string) => void;
}) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [passwordShown, setPasswordShown] = useState(false);
  const [confirmShown, setConfirmShown] = useState(false);

  useEffect(() => {
    if (visible) {
      setPassword('');
      setConfirm('');
      setError(null);
      setPasswordShown(false);
      setConfirmShown(false);
    }
  }, [visible]);

  if (!visible) return null;

  function submit() {
    if (!password) {
      setError('Password cannot be empty');
      return;
    }
    if (confirmRequired && confirm !== password) {
      setError('Passwords did not match — try again');
      return;
    }
    onSubmit(password);
  }

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
          <View style={styles.inputRow}>
            <TextInput
              value={password}
              onChangeText={t => {
                setPassword(t);
                setError(null);
              }}
              secureTextEntry={!passwordShown}
              autoFocus
              placeholder="Password"
              placeholderTextColor={colors.textTertiary}
              style={styles.inputField}
            />
            <Pressable
              onPress={() => setPasswordShown(v => !v)}
              hitSlop={8}
              style={styles.toggleBtn}
            >
              <Text style={styles.toggleText}>
                {passwordShown ? 'Hide' : 'Show'}
              </Text>
            </Pressable>
          </View>
          {confirmRequired && (
            <View style={styles.inputRow}>
              <TextInput
                value={confirm}
                onChangeText={t => {
                  setConfirm(t);
                  setError(null);
                }}
                secureTextEntry={!confirmShown}
                placeholder="Confirm password"
                placeholderTextColor={colors.textTertiary}
                style={styles.inputField}
              />
              <Pressable
                onPress={() => setConfirmShown(v => !v)}
                hitSlop={8}
                style={styles.toggleBtn}
              >
                <Text style={styles.toggleText}>
                  {confirmShown ? 'Hide' : 'Show'}
                </Text>
              </Pressable>
            </View>
          )}
          {error && <Text style={styles.error}>{error}</Text>}
          <View style={styles.actions}>
            <Pressable style={styles.cancelBtn} onPress={onCancel}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable style={styles.okBtn} onPress={submit}>
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
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg,
    borderColor: colors.hairline,
    borderWidth: 1,
    borderRadius: 10,
    paddingRight: 6,
  },
  inputField: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    fontFamily: font.mono,
    fontSize: 13,
  },
  toggleBtn: { paddingHorizontal: 8, paddingVertical: 6 },
  toggleText: { fontSize: 12, fontWeight: '600', color: colors.accent },
  error: { fontSize: 12, color: colors.fault },
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
