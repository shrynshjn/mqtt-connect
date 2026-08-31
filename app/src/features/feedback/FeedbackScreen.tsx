import React, { useState } from 'react';
import {
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../app/navigation';
import { colors, font, radius, space } from '../../ui/theme';
import { KeyboardAvoidingScreen } from '../../ui/KeyboardAvoidingScreen';
import { SegmentedControl } from '../../ui/SegmentedControl';
import { getAppVersionString } from '../../config/appVersion';
import { FEEDBACK_EMAIL } from '../../config/appLinks';
import { buildFeedbackMailto, type FeedbackType } from './mailto';

type Props = NativeStackScreenProps<RootStackParamList, 'Feedback'>;

const TYPES: { value: FeedbackType; label: string }[] = [
  { value: 'Bug', label: 'Bug' },
  { value: 'Idea', label: 'Idea' },
  { value: 'Question', label: 'Question' },
  { value: 'Other', label: 'Other' },
];

export function FeedbackScreen({ navigation }: Props) {
  const [type, setType] = useState<FeedbackType>('Bug');
  const [message, setMessage] = useState('');
  // Inline, not the global Toast/PromptModal — this screen has `presentation: 'modal'`
  // in navigation.tsx, and the global overlays render behind an already-presented modal
  // screen and silently never appear (the same bug found and fixed this session for
  // Export/Import/Settings; see LocalTextPrompt.tsx for the full explanation).
  const [error, setError] = useState<string | null>(null);

  const versionString = getAppVersionString();

  async function send() {
    if (!message.trim()) {
      setError('Add a message before sending');
      return;
    }
    setError(null);
    const url = buildFeedbackMailto({ type, message, versionString });
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (!canOpen) {
        setError(
          `No email app is set up on this device — you can reach us directly at ${FEEDBACK_EMAIL}`,
        );
        return;
      }
      await Linking.openURL(url);
    } catch (e) {
      setError(`Could not open your mail app · ${(e as Error).message}`);
    }
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </Pressable>
        <Text style={styles.title}>Feedback</Text>
      </View>

      <KeyboardAvoidingScreen behavior="height">
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.label}>Type</Text>
          <SegmentedControl options={TYPES} value={type} onChange={setType} />

          <Text style={[styles.label, styles.messageLabel]}>Message</Text>
          <TextInput
            value={message}
            onChangeText={t => {
              setMessage(t);
              setError(null);
            }}
            multiline
            placeholder="What's on your mind?"
            placeholderTextColor={colors.textTertiary}
            style={styles.input}
          />

          <Text style={styles.hint}>
            This will be included: MQTT Connect {versionString} · {Platform.OS}{' '}
            {Platform.Version}
          </Text>

          {error && <Text style={styles.error}>{error}</Text>}

          <Pressable style={styles.sendBtn} onPress={send}>
            <Text style={styles.sendText}>Send</Text>
          </Pressable>
          <Text style={styles.footnote}>
            Opens your mail app with this pre-filled — you'll still need to tap
            Send there.
          </Text>
        </ScrollView>
      </KeyboardAvoidingScreen>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: space.md,
    paddingTop: 58,
    paddingBottom: space.md,
    borderBottomColor: colors.hairline,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.hairline,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: { color: colors.textSecondary, fontSize: 15 },
  title: { fontSize: 17, fontWeight: '700', color: colors.text },
  content: { padding: space.md, gap: space.sm },
  label: {
    fontFamily: font.mono,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.textTertiary,
  },
  messageLabel: { marginTop: space.lg },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.hairline,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.md,
    minHeight: 140,
    textAlignVertical: 'top',
    color: colors.text,
    fontSize: 14,
  },
  hint: {
    fontFamily: font.mono,
    fontSize: 10.5,
    color: colors.textTertiary,
  },
  error: {
    fontSize: 12.5,
    color: colors.fault,
    lineHeight: 17,
  },
  sendBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: space.md,
  },
  sendText: { fontSize: 15, fontWeight: '700', color: colors.bg },
  footnote: {
    fontSize: 11.5,
    color: colors.textTertiary,
    textAlign: 'center',
    lineHeight: 16,
  },
});
