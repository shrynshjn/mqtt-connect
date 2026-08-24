import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, font, radius, space } from '../../ui/theme';
import { stripSmartPunctuation } from '../../ui/sanitizeText';
import { emptyRow, type KVRow } from '../../ui/jsonKeyValue';

export function KeyValueEditor({
  rows,
  onChange,
}: {
  rows: KVRow[];
  onChange: (rows: KVRow[]) => void;
}) {
  function updateRow(id: string, patch: Partial<KVRow>) {
    onChange(rows.map(r => (r.id === id ? { ...r, ...patch } : r)));
  }
  function removeRow(id: string) {
    onChange(rows.filter(r => r.id !== id));
  }

  return (
    <View style={styles.wrap}>
      {rows.length > 0 && (
        <View style={styles.headerRow}>
          <Text style={[styles.colHeader, styles.keyCol]}>Key</Text>
          <Text style={[styles.colHeader, styles.valueCol]}>Value</Text>
        </View>
      )}
      {rows.map(row => (
        <View key={row.id} style={styles.row}>
          <TextInput
            value={row.key}
            onChangeText={v =>
              updateRow(row.id, { key: stripSmartPunctuation(v) })
            }
            placeholder="key"
            placeholderTextColor={colors.textTertiary}
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            style={[styles.input, styles.keyCol]}
          />
          <TextInput
            value={row.value}
            onChangeText={v =>
              updateRow(row.id, { value: stripSmartPunctuation(v) })
            }
            placeholder="value"
            placeholderTextColor={colors.textTertiary}
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            style={[styles.input, styles.valueCol]}
          />
          <Pressable
            onPress={() => removeRow(row.id)}
            hitSlop={8}
            style={styles.removeBtn}
          >
            <Text style={styles.removeText}>✕</Text>
          </Pressable>
        </View>
      ))}
      <Pressable
        onPress={() => onChange([...rows, emptyRow()])}
        style={styles.addRow}
      >
        <Text style={styles.addText}>+ Add key</Text>
      </Pressable>
      <Text style={styles.hint}>
        A value that parses as JSON (numbers, true/false, null, {'{...}'},
        [...]) keeps that type — anything else is stored as text. Quote a value
        ("007") to force it to stay text.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm },
  headerRow: { flexDirection: 'row', gap: space.sm, paddingHorizontal: 2 },
  colHeader: {
    fontFamily: font.mono,
    fontSize: 9.5,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.textTertiary,
  },
  keyCol: { flex: 1 },
  valueCol: { flex: 1.4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.hairline,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 9,
    fontFamily: font.mono,
    fontSize: 12.5,
    color: colors.text,
  },
  removeBtn: { padding: 4 },
  removeText: { color: colors.textTertiary, fontSize: 13 },
  addRow: {
    alignSelf: 'flex-start',
    borderColor: colors.hairline,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  addText: { fontSize: 12, color: colors.textTertiary },
  hint: {
    fontFamily: font.mono,
    fontSize: 9.5,
    lineHeight: 14,
    color: colors.textTertiary,
  },
});
