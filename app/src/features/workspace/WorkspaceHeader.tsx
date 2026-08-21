import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, font, space } from '../../ui/theme';
import { StatusDot } from '../../ui/StatusDot';
import { formatUptime } from '../../ui/format';
import { getBroker } from '../../storage/brokerRepo';
import { schemeFor, type ConnectionProfile } from '../../types/profile';
import type { ConnectionSnapshot } from '../../types/connection';

export function WorkspaceHeader({
  profile,
  snapshot,
  onBack,
  onToggleConnect,
  onEditCert,
}: {
  profile: ConnectionProfile;
  snapshot: ConnectionSnapshot | undefined;
  onBack: () => void;
  onToggleConnect: () => void;
  onEditCert: () => void;
}) {
  const status = snapshot?.status ?? 'idle';
  const broker = getBroker(profile.brokerId);
  const actionLabel =
    status === 'connected'
      ? 'Disconnect'
      : status === 'error'
        ? 'Retry'
        : 'Connect';

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Pressable onPress={onBack} hitSlop={10} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </Pressable>
        <View style={{ flex: 1, gap: 1 }}>
          <View style={styles.nameRow}>
            <StatusDot status={status} size={8} />
            <Text style={styles.name} numberOfLines={1}>
              {profile.name}
            </Text>
          </View>
          <Text style={styles.host} numberOfLines={1}>
            {broker ? `${schemeFor(broker.transport)}://${broker.host}:${broker.port}` : 'broker not found'}
          </Text>
        </View>
        <Pressable onPress={onEditCert} hitSlop={8} style={styles.editBtn}>
          <Text style={styles.editIcon}>⋯</Text>
        </Pressable>
        <Pressable onPress={onToggleConnect} style={styles.actionBtn}>
          <Text style={styles.actionText}>{actionLabel}</Text>
        </Pressable>
      </View>

      {status === 'connected' && snapshot?.connectedSince && (
        <Text style={styles.statusLine}>
          CONNECTED · {formatUptime(snapshot.connectedSince)} · MQTT{' '}
          {profile.protocolVersion === 5 ? '5.0' : '3.1.1'}
        </Text>
      )}

      {status === 'error' && snapshot?.lastError && (
        <View style={styles.faultBox}>
          <Text style={styles.faultTitle}>Connection failed</Text>
          <Text style={styles.faultText}>{snapshot.lastError.message}</Text>
          {snapshot.lastError.hint && (
            <Text style={styles.faultHint}>{snapshot.lastError.hint}</Text>
          )}
          <View style={styles.faultActions}>
            <Pressable style={styles.faultBtn} onPress={onEditCert}>
              <Text style={styles.faultBtnText}>Replace certificate</Text>
            </Pressable>
            <Pressable style={styles.retryBtn} onPress={onToggleConnect}>
              <Text style={styles.retryBtnText}>Retry</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderBottomColor: colors.hairline,
    borderBottomWidth: 1,
    paddingBottom: space.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: space.md,
    paddingTop: space.sm,
  },
  backBtn: { padding: 4 },
  backIcon: { fontSize: 18, color: colors.textSecondary },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { fontSize: 15, fontWeight: '700', color: colors.text },
  host: { fontFamily: font.mono, fontSize: 10.5, color: colors.textTertiary },
  editBtn: { paddingHorizontal: 6, paddingVertical: 4 },
  editIcon: { fontSize: 17, color: colors.textTertiary, fontWeight: '700' },
  actionBtn: {
    borderColor: colors.hairline,
    borderWidth: 1,
    borderRadius: 9,
    paddingVertical: 6,
    paddingHorizontal: 11,
  },
  actionText: { fontSize: 12, fontWeight: '600', color: colors.accent },
  statusLine: {
    fontFamily: font.mono,
    fontSize: 10.5,
    color: colors.textTertiary,
    paddingHorizontal: space.md,
    paddingTop: 6,
  },
  faultBox: {
    marginHorizontal: space.md,
    marginTop: space.sm,
    backgroundColor: colors.faultDim,
    borderColor: colors.faultBorder,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  faultTitle: { fontSize: 13, fontWeight: '600', color: colors.fault },
  faultText: {
    fontFamily: font.mono,
    fontSize: 10.5,
    color: colors.fault,
    lineHeight: 15,
  },
  faultHint: {
    fontFamily: font.mono,
    fontSize: 10,
    color: colors.fault,
    opacity: 0.8,
    lineHeight: 14,
  },
  faultActions: { flexDirection: 'row', gap: 8, paddingTop: 2 },
  faultBtn: {
    borderColor: 'rgba(255,176,32,0.4)',
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 11,
  },
  faultBtnText: { fontSize: 12.5, fontWeight: '600', color: colors.fault },
  retryBtn: {
    borderColor: colors.hairline,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 11,
  },
  retryBtnText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: colors.textSecondary,
  },
});
