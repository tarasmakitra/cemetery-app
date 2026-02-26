import { StyleSheet, View, Text } from 'react-native';
import { AppColors } from '@/constants/theme';
import type { SyncStatus } from '@/db/types';

const LABELS: Record<SyncStatus, string> = {
  pending: 'Очікує',
  synced: 'Синхронізовано',
  modified: 'Змінено',
  deleted: 'Видалено',
};

export function SyncStatusBadge({ status }: { status: SyncStatus }) {
  const color = AppColors.syncStatus[status] ?? AppColors.syncStatus.pending;

  return (
    <View style={[styles.badge, { backgroundColor: color }]}>
      <Text style={styles.text}>{LABELS[status]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  text: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
});
