import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../app/navigation';
import { colors, font, radius, space } from '../../ui/theme';
import { useToast } from '../../ui/Toast';
import { showPrompt } from '../../ui/PromptModal';
import {
  DEMO_VARIANTS,
  HIVEMQ_TLS_CA_PEM,
  buildQuickStartPlan,
  commitQuickStartPlan,
  type DemoVariant,
  type QuickStartPlan,
} from './hivemqQuickStart';

type Step =
  | { kind: 'confirm'; plan: QuickStartPlan }
  | { kind: 'walkthrough'; plan: QuickStartPlan; profileId: string };

/** Self-contained "try it live" card — a row of one-tap buttons that each set up (or
 * reconnect) a client against HiveMQ's public test broker over a different transport,
 * with a confirmation step first and a short walkthrough after. Dropped into the Hub's
 * empty state and permanently into Settings, so it doesn't need to know which screen
 * it's on. */
export function HiveMQQuickStart() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const show = useToast();
  const [step, setStep] = useState<Step | null>(null);
  const [busy, setBusy] = useState(false);

  function onPickVariant(variant: DemoVariant) {
    setStep({ kind: 'confirm', plan: buildQuickStartPlan(variant) });
  }

  async function onConfirm(plan: QuickStartPlan) {
    let caPem: string | undefined;
    if (plan.variant.requiresCa && !HIVEMQ_TLS_CA_PEM) {
      const pasted = await showPrompt(
        'HiveMQ CA certificate',
        "Paste the PEM certificate chain for broker.hivemq.com — needed once, since this app pins TLS connections to an explicit CA rather than trusting the device's certificate store.",
        { multiline: true },
      );
      if (!pasted) return; // cancelled
      caPem = pasted;
    }
    setBusy(true);
    try {
      const { profileId } = commitQuickStartPlan(plan, caPem);
      setStep({ kind: 'walkthrough', plan, profileId });
    } catch (e) {
      show(`could not set up demo client · ${(e as Error).message}`);
      setStep(null);
    } finally {
      setBusy(false);
    }
  }

  function openClient(profileId: string) {
    setStep(null);
    navigation.navigate('Workspace', { profileId });
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Try it live</Text>
      <Text style={styles.subtitle}>
        One tap sets up a client on HiveMQ's public test broker, subscribes it
        to a topic, and connects — nothing to configure.
      </Text>
      <View style={styles.row}>
        {DEMO_VARIANTS.map(v => (
          <Pressable
            key={v.transport}
            style={styles.chip}
            onPress={() => onPickVariant(v)}
          >
            <Text style={styles.chipText}>{v.scheme}</Text>
          </Pressable>
        ))}
      </View>

      <Modal
        visible={!!step}
        transparent
        animationType="fade"
        onRequestClose={() => setStep(null)}
      >
        <View style={styles.backdrop}>
          {step?.kind === 'confirm' && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Set up a demo client</Text>
              <View style={styles.planList}>
                <PlanRow label="Broker" value={step.plan.brokerName} />
                <PlanRow
                  label="Address"
                  value={`${step.plan.variant.scheme}://${step.plan.host}:${
                    step.plan.port
                  }${step.plan.path ?? ''}`}
                  mono
                />
                <PlanRow label="Client ID" value={step.plan.clientId} mono />
                <PlanRow label="Subscribes to" value={step.plan.topic} mono />
              </View>
              {step.plan.reusingClient && (
                <Text style={styles.hint}>
                  Already set up from an earlier tap — confirming just
                  reconnects it.
                </Text>
              )}
              {step.plan.variant.requiresCa && !HIVEMQ_TLS_CA_PEM && (
                <Text style={styles.hint}>
                  This one is TLS-encrypted — you'll be asked to paste the
                  broker's CA certificate next.
                </Text>
              )}
              <Text style={styles.hint}>
                broker.hivemq.com is a public, shared test broker — anyone can
                see what's published on it, so don't send anything sensitive.
              </Text>
              <View style={styles.actions}>
                <Pressable
                  style={styles.ghostBtn}
                  onPress={() => setStep(null)}
                >
                  <Text style={styles.ghostText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={styles.primaryBtn}
                  disabled={busy}
                  onPress={() => onConfirm(step.plan)}
                >
                  <Text style={styles.primaryText}>
                    {busy ? 'Setting up…' : 'Set it up'}
                  </Text>
                </Pressable>
              </View>
            </View>
          )}

          {step?.kind === 'walkthrough' && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>You're connected</Text>
              <Text style={styles.body}>
                "{step.plan.brokerName}" is connecting to HiveMQ's public broker
                and is subscribed to{' '}
                <Text style={styles.mono}>{step.plan.topic}</Text>.
              </Text>
              <Text style={styles.body}>
                Try it: open this client, go to the Publish tab, keep the topic
                as-is, type any message, and hit Publish — it'll show up in the
                Feed tab a moment later.
              </Text>
              <View style={styles.actions}>
                <Pressable
                  style={styles.ghostBtn}
                  onPress={() => setStep(null)}
                >
                  <Text style={styles.ghostText}>Done</Text>
                </Pressable>
                <Pressable
                  style={styles.primaryBtn}
                  onPress={() => openClient(step.profileId)}
                >
                  <Text style={styles.primaryText}>Open this client</Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

function PlanRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <View style={styles.planRow}>
      <Text style={styles.planLabel}>{label}</Text>
      <Text style={[styles.planValue, mono && styles.mono]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.surface,
    borderColor: colors.hairlineHi,
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: space.lg,
    gap: space.sm,
  },
  title: { fontSize: 15, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: 12.5, color: colors.textSecondary, lineHeight: 18 },
  row: { flexDirection: 'row', gap: 8, marginTop: 4 },
  chip: {
    flex: 1,
    alignItems: 'center',
    borderColor: colors.hairline,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: 10,
  },
  chipText: {
    fontFamily: font.mono,
    fontSize: 12,
    fontWeight: '600',
    color: colors.accent,
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
    maxWidth: 360,
    backgroundColor: colors.surface,
    borderColor: colors.hairlineHi,
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: space.lg,
    gap: space.md,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  body: { fontSize: 13, color: colors.textSecondary, lineHeight: 19 },
  planList: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.hairline,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: 10,
    gap: 6,
  },
  planRow: { flexDirection: 'row', gap: 8 },
  planLabel: {
    fontSize: 11.5,
    color: colors.textTertiary,
    width: 92,
  },
  planValue: { flex: 1, fontSize: 12.5, color: colors.text },
  mono: { fontFamily: font.mono, fontSize: 12 },
  hint: {
    fontFamily: font.mono,
    fontSize: 10,
    lineHeight: 15,
    color: colors.textTertiary,
  },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: space.sm },
  ghostBtn: { paddingVertical: 9, paddingHorizontal: 14 },
  ghostText: { fontSize: 14, color: colors.textSecondary },
  primaryBtn: {
    paddingVertical: 9,
    paddingHorizontal: 14,
    backgroundColor: colors.accentDim,
    borderRadius: radius.sm,
  },
  primaryText: { fontSize: 14, fontWeight: '600', color: colors.accent },
});
