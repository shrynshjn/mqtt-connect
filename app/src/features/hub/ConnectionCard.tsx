import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, font, radius, space } from '../../ui/theme';
import { StatusDot, statusKind } from '../../ui/StatusDot';
import { formatUptime, formatRelative } from '../../ui/format';
import { getSavedTopics } from '../../storage/subscriptionRepo';
import type { ConnectionProfile } from '../../types/profile';
import type { ConnectionSnapshot } from '../../types/connection';

const STATUS_LABEL = { live: 'live', fault: 'fault', idle: 'idle' } as const;

export function ConnectionCard({
  profile,
  snapshot,
  onOpen,
  onToggleConnect,
  onEdit,
}: {
  profile: ConnectionProfile;
  snapshot: ConnectionSnapshot | undefined;
  onOpen: () => void;
  onToggleConnect: () => void;
  onEdit: () => void;
}) {
  const status = snapshot?.status ?? 'idle';
  const kind = statusKind(status);
  const savedCount = getSavedTopics(profile.id).length;

  const stats: string[] =
    status === 'connected'
      ? [
          `${snapshot?.subscriptions.length ?? 0} subs`,
          `${snapshot?.counters.rx ?? 0} msgs`,
          snapshot?.connectedSince ? formatUptime(snapshot.connectedSince) : '',
        ].filter(Boolean)
      : status === 'error'
        ? [`${savedCount} saved`, profile.lastConnectedAt ? `last ok ${formatRelative(new Date(profile.lastConnectedAt).getTime())}` : 'never connected']
        : [`${savedCount} saved`, profile.lastConnectedAt ? `last ${formatRelative(new Date(profile.lastConnectedAt).getTime())}` : 'never connected'];

  const actionLabel = status === 'connected' ? 'Disconnect' : status === 'error' ? 'Retry' : 'Connect';

  return (
    <Pressable onPress={onOpen} style={[styles.card, kind === 'fault' && styles.cardFault]}>
      <View style={styles.top}>
        <StatusDot status={status} />
        <Text style={styles.name} numberOfLines={1}>
          {profile.name}
        </Text>
        <Text style={styles.statusChip}>{STATUS_LABEL[kind]}</Text>
        {snapshot?.counters.rx && status === 'connected' ? <Text style={styles.badge}>{snapshot.counters.rx}</Text> : null}
        <Pressable onPress={onEdit} hitSlop={8} style={styles.moreBtn}>
          <Text style={styles.moreText}>⋯</Text>
        </Pressable>
      </View>

      <Text style={styles.host} numberOfLines={1}>
        {profile.transport}://{profile.host}:{profile.port}
        {profile.tls?.identity ? '  ▣ cert' : ''}
      </Text>

      <View style={styles.statsRow}>
        {stats.map(s => (
          <Text key={s} style={styles.stat}>
            {s}
          </Text>
        ))}
        <View style={{ flex: 1 }} />
        <Pressable onPress={onToggleConnect} style={styles.actionBtn} hitSlop={8}>
          <Text style={[styles.actionText, kind === 'fault' && { color: colors.fault }]}>{actionLabel}</Text>
        </Pressable>
      </View>

      {kind === 'fault' && snapshot?.lastError && (
        <View style={styles.faultBanner}>
          <Text style={styles.faultText}>{snapshot.lastError.message}</Text>
          {snapshot.lastError.hint && <Text style={styles.faultHint}>{snapshot.lastError.hint}</Text>}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.hairline,
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: space.lg,
    gap: 10,
    marginBottom: space.sm,
  },
  cardFault: {
    borderColor: colors.faultBorder,
  },
  top: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  name: { flex: 1, fontSize: 15.5, fontWeight: '600', color: colors.text },
  statusChip: {
    fontFamily: font.mono,
    fontSize: 10,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.textTertiary,
  },
  badge: {
    fontFamily: font.mono,
    fontSize: 10.5,
    color: colors.accent,
    backgroundColor: colors.accentDim,
    borderRadius: 9,
    paddingHorizontal: 7,
    paddingVertical: 1,
    overflow: 'hidden',
  },
  moreBtn: { paddingHorizontal: 4, paddingVertical: 2 },
  moreText: { fontSize: 16, color: colors.textTertiary, fontWeight: '700' },
  host: { fontFamily: font.mono, fontSize: 11, color: colors.textTertiary },
  statsRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  stat: { fontFamily: font.mono, fontSize: 10.5, color: colors.textSecondary },
  actionBtn: { paddingVertical: 5, paddingHorizontal: 10, borderRadius: radius.sm, borderColor: colors.hairline, borderWidth: 1 },
  actionText: { fontSize: 12.5, fontWeight: '600', color: colors.accent },
  faultBanner: {
    backgroundColor: colors.faultDim,
    borderColor: colors.faultBorder,
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    gap: 4,
  },
  faultText: { fontFamily: font.mono, fontSize: 10.5, color: colors.fault, lineHeight: 15 },
  faultHint: { fontFamily: font.mono, fontSize: 10, color: colors.fault, opacity: 0.8, lineHeight: 14 },
});
