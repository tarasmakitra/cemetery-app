import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSyncContext } from '@/contexts/SyncContext';

export function SyncStatusOverlay() {
  const {
    activity,
    pendingGraves,
    pendingImages,
    totalGraves,
    totalImages,
    isRunning,
    nextSyncIn,
    backgroundSyncEnabled,
  } = useSyncContext();
  const router = useRouter();

  let activityText = '';
  if (activity === 'syncing_graves') {
    activityText = 'Синхронізація записів...';
  } else if (typeof activity === 'object' && 'uploading' in activity) {
    activityText = `Завантаження фото ${activity.uploading}/${activity.total}`;
  } else if (activity === 'error') {
    activityText = 'Помилка синхронізації';
  }

  const isBusy = activity !== 'idle' && activity !== 'error';

  return (
    <TouchableOpacity
      style={styles.pill}
      onPress={() => router.push('/(tabs)/sync')}
      activeOpacity={0.7}
    >
      {/* Row 1: totals */}
      <View style={styles.row}>
        <Text style={styles.label}>Записів:</Text>
        <Text style={styles.value}>{totalGraves}</Text>
        <Text style={[styles.label, styles.spacer]}>Фото:</Text>
        <Text style={styles.value}>{totalImages}</Text>
      </View>

      {/* Row 2: pending */}
      {(pendingGraves > 0 || pendingImages > 0) && (
        <View style={styles.row}>
          {pendingGraves > 0 && (
            <>
              <Text style={styles.pendingIcon}>●</Text>
              <Text style={styles.pendingText}>{pendingGraves} зап.</Text>
            </>
          )}
          {pendingImages > 0 && (
            <>
              <Text style={[styles.pendingIcon, pendingGraves > 0 && styles.spacer]}>●</Text>
              <Text style={styles.pendingText}>{pendingImages} фото</Text>
            </>
          )}
        </View>
      )}

      {/* Row 3: activity / countdown */}
      {(isBusy || nextSyncIn > 0 || activity === 'error') && (
        <View style={styles.row}>
          {isBusy && (
            <ActivityIndicator size="small" color="#fff" style={styles.spinner} />
          )}
          {activityText !== '' && (
            <Text style={[styles.activityText, activity === 'error' && styles.errorText]}>
              {activityText}
            </Text>
          )}
          {!isBusy && nextSyncIn > 0 && backgroundSyncEnabled && (
            <Text style={styles.countdownText}>
              Наступна синх. через {nextSyncIn}с
            </Text>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  pill: {
    position: 'absolute',
    top: 60,
    left: 12,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 4,
    minWidth: 140,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  label: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
  },
  value: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 4,
  },
  spacer: {
    marginLeft: 10,
  },
  pendingIcon: {
    color: '#FF9800',
    fontSize: 8,
    marginRight: 4,
  },
  pendingText: {
    color: '#FF9800',
    fontSize: 12,
    fontWeight: '600',
  },
  spinner: {
    marginRight: 6,
    transform: [{ scale: 0.7 }],
  },
  activityText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 11,
    fontWeight: '500',
  },
  errorText: {
    color: '#F44336',
  },
  countdownText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
  },
});
