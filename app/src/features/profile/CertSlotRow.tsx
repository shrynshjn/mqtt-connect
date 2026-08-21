import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, font, radius } from '../../ui/theme';
import { daysUntilExpiry } from '../../crypto/certInfo';
import type { CertMeta } from '../../types/profile';

export interface CertSlotValue {
  fileName: string;
  meta?: CertMeta; // absent for the key slot, which has no cert metadata of its own
}

export function CertSlotRow({
  label,
  hint,
  value,
  onPick,
  onClear,
}: {
  label: string;
  hint: string;
  value: CertSlotValue | null;
  onPick: () => void;
  onClear: () => void;
}) {
  const expiry = value?.meta?.notAfter
    ? daysUntilExpiry(value.meta.notAfter)
    : undefined;
  const expiringSoon = expiry != null && expiry < 30;

  return (
    <View style={[styles.row, expiringSoon && styles.rowWarn]}>
      <View style={styles.body}>
        <Text style={styles.label}>{label}</Text>
        <Text
          style={[styles.file, !value && styles.filePlaceholder]}
          numberOfLines={1}
        >
          {value ? value.fileName : `${hint} — not selected`}
        </Text>
        {value?.meta && (
          <Text style={[styles.meta, expiringSoon && styles.metaWarn]}>
            {value.meta.subjectCn ? `CN=${value.meta.subjectCn} · ` : ''}
            {expiry != null
              ? expiry < 0
                ? 'EXPIRED'
                : `expires in ${expiry}d`
              : ''}
          </Text>
        )}
        {value && !value.meta && <Text style={styles.meta}>imported</Text>}
      </View>
      <Pressable onPress={onPick} style={styles.actionBtn}>
        <Text style={styles.actionText}>
          {value ? 'Replace' : 'Choose file'}
        </Text>
      </Pressable>
      {value && (
        <Pressable onPress={onClear} hitSlop={8} style={styles.clearBtn}>
          <Text style={styles.clearText}>✕</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.hairline,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: 10,
  },
  rowWarn: { borderColor: colors.faultBorder },
  body: { flex: 1, gap: 3 },
  label: { fontSize: 12, fontWeight: '600', color: colors.text },
  file: { fontFamily: font.mono, fontSize: 10.5, color: colors.textSecondary },
  filePlaceholder: { color: colors.textTertiary },
  meta: { fontFamily: font.mono, fontSize: 10, color: colors.textTertiary },
  metaWarn: { color: colors.fault },
  actionBtn: {
    borderColor: colors.hairlineHi,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  actionText: { fontSize: 12, fontWeight: '600', color: colors.accent },
  clearBtn: { padding: 4 },
  clearText: { color: colors.textTertiary, fontSize: 12 },
});
