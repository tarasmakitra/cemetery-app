import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { BottomSheetModal, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { getGraveById, updateGrave } from '@/db/graves';
import { insertImage } from '@/db/images';
import { generateUUID } from '@/utils/uuid';
import { processCameraImage } from '@/utils/images';
import { getImageProcessingMode } from '@/constants/storage';
import { SyncStatusBadge } from './SyncStatusBadge';
import { NudgeControls } from './NudgeControls';
import { ImageViewer } from './ImageViewer';
import { AppColors } from '@/constants/theme';
import { snapToGrid } from '@/utils/snap';
import type { GraveWithRelations, UploadStatus } from '@/db/types';

function imageBorderColor(status: UploadStatus): string {
  switch (status) {
    case 'store_only': return '#2196F3';
    case 'pending':    return '#f44336';
    case 'uploaded':   return '#4CAF50';
    default:           return '#4CAF50';
  }
}

interface GraveDetailSheetProps {
  bottomSheetRef: React.RefObject<BottomSheetModal | null>;
  graveLocalId: string | null;
  onDismiss?: () => void;
  onCoordsChanged?: () => void;
}

const TYPE_LABELS: Record<string, string> = {
  REGULAR: 'Звичайна',
  SMALL: 'Мала',
  DOUBLE: 'Подвійна',
  TRIPLE: 'Потрійна',
  TREE: 'Дерево',
  OTHER: 'Інше',
};

function formatDate(day: string, month: string, year: string): string {
  const parts = [day, month, year].filter(Boolean);
  return parts.join('.');
}

export function GraveDetailSheet({ bottomSheetRef, graveLocalId, onDismiss, onCoordsChanged }: GraveDetailSheetProps) {
  const db = useSQLiteContext();
  const router = useRouter();
  const snapPoints = useMemo(() => ['40%', '65%'], []);
  const [grave, setGrave] = useState<GraveWithRelations | null>(null);
  const [viewerIndex, setViewerIndex] = useState(-1);
  const [showNudge, setShowNudge] = useState(false);

  const loadGrave = useCallback(() => {
    if (graveLocalId) {
      getGraveById(db, graveLocalId).then(setGrave);
    }
  }, [db, graveLocalId]);

  useEffect(() => {
    loadGrave();
  }, [loadGrave]);

  const handleSheetChange = useCallback((index: number) => {
    if (index >= 0) loadGrave();
  }, [loadGrave]);

  const handleEdit = useCallback(() => {
    if (!grave) return;
    bottomSheetRef.current?.dismiss();
    router.push(`/grave/${grave.local_id}` as any);
  }, [grave, bottomSheetRef, router]);

  const handleNudge = useCallback(
    async (dlat: number, dlng: number) => {
      if (!grave) return;
      const snapped = snapToGrid(grave.latitude + dlat, grave.longitude + dlng);
      await updateGrave(db, grave.local_id, { latitude: snapped.latitude, longitude: snapped.longitude });
      setGrave((prev) => (prev ? { ...prev, latitude: snapped.latitude, longitude: snapped.longitude } : prev));
      onCoordsChanged?.();
    },
    [db, grave, onCoordsChanged],
  );

  const pickFromCamera = useCallback(async () => {
    if (!grave) return;
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Помилка', 'Потрібен доступ до камери');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 1,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets[0]) {
      const imageId = generateUUID();
      const mode = await getImageProcessingMode();
      const fileUri = await processCameraImage(result.assets[0].uri, imageId, grave.uid, mode);
      await insertImage(db, {
        local_id: imageId,
        grave_local_id: grave.local_id,
        server_id: null,
        file_uri: fileUri,
        full_uri: fileUri,
        upload_status: mode === 'store_only' ? 'store_only' : 'pending',
      });
      loadGrave();
    }
  }, [db, grave, loadGrave]);

  if (!grave) return null;

  return (
    <BottomSheetModal
      ref={bottomSheetRef}
      snapPoints={snapPoints}
      enableDynamicSizing={false}
      onDismiss={onDismiss}
      onChange={handleSheetChange}
    >
      <BottomSheetScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>
            {TYPE_LABELS[grave.type] ?? grave.type}
          </Text>
          <SyncStatusBadge status={grave.sync_status} />
        </View>

        {grave.location ? <Text style={styles.label}>Розташування: {grave.location}</Text> : null}

        <View style={styles.coordsRow}>
          <Text style={styles.label}>
            Координати: {grave.latitude.toFixed(6)}, {grave.longitude.toFixed(6)}
          </Text>
          <TouchableOpacity
            style={[styles.nudgeToggle, showNudge && styles.nudgeToggleActive]}
            onPress={() => setShowNudge((v) => !v)}
          >
            <MaterialIcons name="open-with" size={16} color="#fff" />
          </TouchableOpacity>
        </View>
        {showNudge && <NudgeControls onNudge={handleNudge} />}

        {grave.persons.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Поховані</Text>
            {grave.persons.map((p) => {
              const birth = formatDate(p.birth_day, p.birth_month, p.birth_year);
              const death = formatDate(p.death_day, p.death_month, p.death_year);
              return (
                <View key={p.local_id} style={styles.personRow}>
                  <Text style={styles.personName}>
                    {p.name || 'Невідомий'}
                  </Text>
                  {(birth || death) && (
                    <Text style={styles.personDates}>
                      {birth || '?'} — {death || '?'}
                    </Text>
                  )}
                </View>
              );
            })}
          </>
        )}

        {grave.notes ? <Text style={styles.notes}>{grave.notes}</Text> : null}

        <View style={styles.photoHeader}>
          <Text style={styles.sectionTitle}>Фото</Text>
          <TouchableOpacity style={styles.cameraBtn} onPress={pickFromCamera}>
            <MaterialIcons name="camera-alt" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
        {grave.images.length > 0 ? (
          <>
            <View style={styles.photoGrid}>
              {grave.images.map((img, idx) => (
                <TouchableOpacity key={img.local_id} onPress={() => setViewerIndex(idx)}>
                  <Image source={{ uri: img.file_uri }} style={[styles.photoThumb, { borderWidth: 2, borderColor: imageBorderColor(img.upload_status) }]} />
                </TouchableOpacity>
              ))}
            </View>
            <ImageViewer
              images={grave.images.map((img) => ({ uri: img.file_uri, fullUri: img.full_uri || img.file_uri }))}
              initialIndex={viewerIndex >= 0 ? viewerIndex : 0}
              visible={viewerIndex >= 0}
              onClose={() => setViewerIndex(-1)}
            />
          </>
        ) : (
          <Text style={styles.noPhotos}>Немає фотографій</Text>
        )}

        <View style={styles.actions}>
          <TouchableOpacity style={styles.editBtn} onPress={handleEdit}>
            <Text style={styles.editBtnText}>Редагувати</Text>
          </TouchableOpacity>
        </View>
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
    marginRight: 8,
  },
  coordsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  label: {
    fontSize: 13,
    color: '#555',
  },
  nudgeToggle: {
    backgroundColor: AppColors.fab.background,
    borderRadius: 14,
    padding: 6,
  },
  nudgeToggleActive: {
    backgroundColor: AppColors.success,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 8,
    marginBottom: 8,
  },
  photoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cameraBtn: {
    backgroundColor: AppColors.fab.background,
    borderRadius: 14,
    padding: 6,
  },
  noPhotos: {
    color: '#999',
    fontStyle: 'italic',
    marginBottom: 4,
  },
  personRow: {
    marginBottom: 8,
    paddingLeft: 8,
    borderLeftWidth: 3,
    borderLeftColor: AppColors.success,
  },
  personName: {
    fontSize: 15,
    fontWeight: '600',
  },
  personDates: {
    fontSize: 13,
    color: '#777',
  },
  notes: {
    marginTop: 4,
    fontSize: 14,
    color: '#555',
    fontStyle: 'italic',
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  photoThumb: {
    width: 100,
    height: 100,
    borderRadius: 8,
    backgroundColor: '#e0e0e0',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  editBtn: {
    flex: 1,
    backgroundColor: AppColors.fab.background,
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  editBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
