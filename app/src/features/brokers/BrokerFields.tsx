import React from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, font, radius, space } from '../../ui/theme';
import { SegmentedControl } from '../../ui/SegmentedControl';
import { stripSmartPunctuation } from '../../ui/sanitizeText';
import { defaultPortFor, type Transport } from '../../types/profile';

export interface BrokerDraft {
  name: string;
  host: string;
  port: string;
  transport: Transport;
}

/** Shared Name/Host/Port/Protocol fields — used by both the full broker form and the
 * inline "new broker" mode inside the picker, so the two never drift apart. */
export function BrokerFields({
  draft,
  onChange,
}: {
  draft: BrokerDraft;
  onChange: (draft: BrokerDraft) => void;
}) {
  function onTransportChange(next: Transport) {
    const wasDefaultPort =
      draft.port === '' ||
      draft.port === String(defaultPortFor(draft.transport));
    onChange({
      ...draft,
      transport: next,
      port: wasDefaultPort ? String(defaultPortFor(next)) : draft.port,
    });
  }

  return (
    <View style={{ gap: space.sm }}>
      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.label}>Name</Text>
          <TextInput
            value={draft.name}
            onChangeText={v =>
              onChange({ ...draft, name: stripSmartPunctuation(v) })
            }
            placeholder="Production EMQX"
            placeholderTextColor={colors.textTertiary}
            style={styles.input}
          />
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Host</Text>
          <TextInput
            value={draft.host}
            onChangeText={v =>
              onChange({ ...draft, host: stripSmartPunctuation(v) })
            }
            placeholder="broker.example.com"
            placeholderTextColor={colors.textTertiary}
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            style={[styles.input, styles.mono]}
          />
        </View>
        <View style={[styles.row, styles.rowLast]}>
          <Text style={styles.label}>Port</Text>
          <TextInput
            value={draft.port}
            onChangeText={v => onChange({ ...draft, port: v })}
            keyboardType="number-pad"
            style={[styles.input, styles.mono]}
          />
        </View>
      </View>
      <SegmentedControl
        options={[
          { value: 'tcp', label: 'mqtt' },
          { value: 'tls', label: 'mqtts' },
          { value: 'ws', label: 'ws' },
          { value: 'wss', label: 'wss' },
        ]}
        value={draft.transport}
        onChange={onTransportChange}
      />
    </View>
  );
}

const styles = StyleSheet.create({
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
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderBottomColor: colors.hairline,
    borderBottomWidth: 1,
  },
  rowLast: { borderBottomWidth: 0 },
  label: { fontSize: 14, color: colors.textSecondary, width: 60 },
  input: {
    flex: 1,
    textAlign: 'right',
    fontSize: 14,
    color: colors.text,
    padding: 0,
  },
  mono: { fontFamily: font.mono, fontSize: 13 },
});
