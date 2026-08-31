import React, { useState } from 'react';
import {
  Alert,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../app/navigation';
import { colors, font, radius, space } from '../../ui/theme';
import { ToggleSwitch } from '../../ui/ToggleSwitch';
import { getPrefs, setPrefs } from '../../storage/prefsRepo';
import { LocalTextPrompt } from '../../ui/LocalTextPrompt';
import { useToast } from '../../ui/Toast';
import { useProfilesStore } from '../../state/profilesStore';
import { getAppVersionString } from '../../config/appVersion';
import {
  developerSiteUrl,
  privacyPolicyUrl,
  termsUrl,
} from '../../config/appLinks';
import { openStoreListing } from '../../review/reviewPrompt';
import { HiveMQQuickStart } from '../demo/HiveMQQuickStart';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

export function SettingsScreen({ navigation }: Props) {
  const [prefs, setLocalPrefs] = useState(getPrefs());
  const show = useToast();
  const [bufferPromptOpen, setBufferPromptOpen] = useState(false);

  function update(patch: Partial<ReturnType<typeof getPrefs>>) {
    setLocalPrefs(setPrefs(patch));
  }

  function eraseAllData() {
    useProfilesStore.getState().eraseAll();
    navigation.popToTop();
    show('All data erased');
  }

  function onBufferCapSubmit(value: string) {
    setBufferPromptOpen(false);
    const n = Number(value);
    if (Number.isFinite(n) && n > 0)
      update({ messageBufferPerConnection: Math.floor(n) });
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </Pressable>
        <Text style={styles.title}>Settings</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Demo</Text>
          <HiveMQQuickStart />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Brokers</Text>
          <View style={styles.card}>
            <Pressable onPress={() => navigation.navigate('Brokers')}>
              <Row label="Manage brokers" last>
                <Text style={styles.chevron}>›</Text>
              </Row>
            </Pressable>
          </View>
          <Text style={styles.hint}>
            A broker is the server you connect to (host, port, protocol) — saved
            separately so multiple clients can share the same one.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Security</Text>
          <View style={styles.card}>
            <Row label="Require Face ID to open">
              <ToggleSwitch
                value={prefs.requireFaceIdToOpen}
                onChange={v => update({ requireFaceIdToOpen: v })}
              />
            </Row>
            <Row label="Lock after">
              <Text style={styles.value}>
                {prefs.autoLockSeconds / 60} minutes
              </Text>
            </Row>
            <Row label="Hide payloads in app switcher" last>
              <ToggleSwitch
                value={prefs.hidePayloadsInAppSwitcher}
                onChange={v => update({ hidePayloadsInAppSwitcher: v })}
              />
            </Row>
          </View>
          <Text style={styles.hint}>
            Clients, credentials and certificates are stored in the device
            keychain, encrypted at rest. Nothing is sent anywhere but to the
            brokers you configure.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Data</Text>
          <View style={styles.card}>
            <Pressable onPress={() => setBufferPromptOpen(true)}>
              <Row label="Message buffer per connection">
                <Text style={styles.value}>
                  {prefs.messageBufferPerConnection.toLocaleString()}
                </Text>
              </Row>
            </Pressable>
            <Pressable onPress={() => navigation.navigate('ExportPicker')}>
              <Row label="Export clients & brokers">
                <Text style={styles.chevron}>›</Text>
              </Row>
            </Pressable>
            <Pressable onPress={() => navigation.navigate('Import')}>
              <Row label="Import clients & brokers">
                <Text style={styles.chevron}>›</Text>
              </Row>
            </Pressable>
            <Pressable
              onPress={() =>
                Alert.alert(
                  'Erase all data',
                  'This removes every client, broker, credential, and certificate from this device. This cannot be undone.',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Erase',
                      style: 'destructive',
                      onPress: eraseAllData,
                    },
                  ],
                )
              }
            >
              <Row
                label="Erase all data"
                labelStyle={{ color: colors.fault }}
                last
              />
            </Pressable>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Legal</Text>
          <View style={styles.card}>
            <Pressable onPress={() => Linking.openURL(privacyPolicyUrl())}>
              <Row label="Privacy Policy">
                <Text style={styles.chevron}>›</Text>
              </Row>
            </Pressable>
            <Pressable onPress={() => Linking.openURL(termsUrl())}>
              <Row label="Terms of Use" last>
                <Text style={styles.chevron}>›</Text>
              </Row>
            </Pressable>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Feedback &amp; Rating</Text>
          <View style={styles.card}>
            <Pressable onPress={() => navigation.navigate('Feedback')}>
              <Row label="Send feedback">
                <Text style={styles.chevron}>›</Text>
              </Row>
            </Pressable>
            <Pressable onPress={openStoreListing}>
              <Row label="Rate MQTT Connect" last>
                <Text style={styles.chevron}>›</Text>
              </Row>
            </Pressable>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Developer</Text>
          <View style={styles.developerCard}>
            <Image
              source={require('../../assets/images/developer-caricature.png')}
              style={styles.avatar}
            />
            <Text style={styles.developerNote}>
              I'm the CTO of an IoT company, managing all kinds of connected
              devices day to day — and MQTT Connect exists because I needed it
              myself. Built with care, it's exactly the MQTT client I wanted on
              my own phone.
            </Text>
          </View>
          <View style={styles.card}>
            <Pressable onPress={() => Linking.openURL(developerSiteUrl())}>
              <Row label="Visit my website" last>
                <Text style={styles.chevron}>›</Text>
              </Row>
            </Pressable>
          </View>
        </View>

        <Text style={styles.footer}>
          MQTT Connect {getAppVersionString()}
          {'\n'}offline · no telemetry
        </Text>
      </ScrollView>

      <LocalTextPrompt
        visible={bufferPromptOpen}
        title="Message buffer per connection"
        message="How many messages to keep per connection before older ones are trimmed."
        initialValue={String(prefs.messageBufferPerConnection)}
        keyboardType="number-pad"
        onCancel={() => setBufferPromptOpen(false)}
        onSubmit={onBufferCapSubmit}
      />
    </View>
  );
}

function Row({
  label,
  labelStyle,
  last,
  children,
}: {
  label: string;
  labelStyle?: object;
  last?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <View style={[styles.row, last && styles.rowLast]}>
      <Text style={[styles.rowLabel, labelStyle]}>{label}</Text>
      {children}
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
  content: { padding: space.lg, gap: space.xl },
  section: { gap: space.sm },
  sectionLabel: {
    fontFamily: font.mono,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.textTertiary,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.hairline,
    borderWidth: 1,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderBottomColor: colors.hairline,
    borderBottomWidth: 1,
  },
  rowLast: { borderBottomWidth: 0 },
  rowLabel: { fontSize: 14, color: colors.text, flex: 1 },
  value: { fontSize: 13, color: colors.textTertiary },
  chevron: { fontSize: 14, color: colors.textTertiary },
  developerCard: {
    backgroundColor: colors.surface,
    borderColor: colors.hairline,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: space.md,
    flexDirection: 'row',
    gap: space.md,
    alignItems: 'center',
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.surfaceRaised,
  },
  developerNote: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSecondary,
  },
  hint: {
    fontFamily: font.mono,
    fontSize: 10,
    lineHeight: 16,
    color: colors.textTertiary,
  },
  footer: {
    textAlign: 'center',
    fontFamily: font.mono,
    fontSize: 10,
    color: colors.textTertiary,
    lineHeight: 17,
  },
});
