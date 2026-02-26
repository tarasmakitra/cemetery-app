import { useCallback, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, Image, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { File } from 'expo-file-system';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useSQLiteContext } from 'expo-sqlite';
import { AppColors } from '@/constants/theme';
import { insertImage, deleteImage } from '@/db/images';
import { generateUUID } from '@/utils/uuid';
import { processCameraImage, saveGalleryImage } from '@/utils/images';
import { getImageProcessingMode } from '@/constants/storage';
import { ImageViewer } from './ImageViewer';
import type { LocalGraveImage } from '@/db/types';

interface GraveImagePickerProps {
  graveLocalId: string;
  graveUid: string;
  images: LocalGraveImage[];
  onImagesChanged: () => void;
}

export function GraveImagePicker({ graveLocalId, graveUid, images, onImagesChanged }: GraveImagePickerProps) {
  const db = useSQLiteContext();
  const [viewerIndex, setViewerIndex] = useState(-1);

  const saveCameraImage = useCallback(async (uri: string) => {
    const imageId = generateUUID();
    const mode = await getImageProcessingMode();
    const fileUri = await processCameraImage(uri, imageId, graveUid, mode);

    await insertImage(db, {
      local_id: imageId,
      grave_local_id: graveLocalId,
      server_id: null,
      file_uri: fileUri,
      full_uri: fileUri,
      upload_status: mode === 'store_only' ? 'store_only' : 'pending',
    });
    onImagesChanged();
  }, [db, graveLocalId, graveUid, onImagesChanged]);

  const saveGalleryImg = useCallback(async (uri: string) => {
    const imageId = generateUUID();
    const mode = await getImageProcessingMode();
    const fileUri = await saveGalleryImage(uri, imageId, graveUid, mode);

    await insertImage(db, {
      local_id: imageId,
      grave_local_id: graveLocalId,
      server_id: null,
      file_uri: fileUri,
      full_uri: fileUri,
      upload_status: mode === 'store_only' ? 'store_only' : 'pending',
    });
    onImagesChanged();
  }, [db, graveLocalId, graveUid, onImagesChanged]);

  const pickFromCamera = useCallback(async () => {
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
      await saveCameraImage(result.assets[0].uri);
    }
  }, [saveCameraImage]);

  const pickFromGallery = useCallback(async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Помилка', 'Потрібен доступ до галереї');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      quality: 1,
      allowsMultipleSelection: true,
      selectionLimit: 10,
    });
    if (!result.canceled) {
      for (const asset of result.assets) {
        await saveGalleryImg(asset.uri);
      }
    }
  }, [saveGalleryImg]);

  const handleDelete = useCallback((img: LocalGraveImage) => {
    Alert.alert('Видалити фото?', 'Цю дію не можна скасувати.', [
      { text: 'Скасувати', style: 'cancel' },
      {
        text: 'Видалити',
        style: 'destructive',
        onPress: async () => {
          try {
            const file = new File(img.file_uri);
            if (file.exists) file.delete();
          } catch {}
          await deleteImage(db, img.local_id);
          onImagesChanged();
        },
      },
    ]);
  }, [db, onImagesChanged]);

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Фотографії</Text>

      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.pickBtn} onPress={pickFromCamera}>
          <MaterialIcons name="camera-alt" size={20} color="#fff" />
          <Text style={styles.pickBtnText}>Камера</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.pickBtn} onPress={pickFromGallery}>
          <MaterialIcons name="photo-library" size={20} color="#fff" />
          <Text style={styles.pickBtnText}>Галерея</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.grid}>
        {images.map((img, idx) => (
          <View key={img.local_id} style={styles.imageWrapper}>
            <TouchableOpacity onPress={() => setViewerIndex(idx)}>
              <Image source={{ uri: img.file_uri }} style={styles.image} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(img)}>
              <MaterialIcons name="close" size={16} color="#fff" />
            </TouchableOpacity>
          </View>
        ))}
      </View>

      <ImageViewer
        images={images.map((img) => ({ uri: img.file_uri, fullUri: img.full_uri || img.file_uri }))}
        initialIndex={viewerIndex >= 0 ? viewerIndex : 0}
        visible={viewerIndex >= 0}
        onClose={() => setViewerIndex(-1)}
      />

      {images.length === 0 && (
        <Text style={styles.emptyText}>Немає фотографій</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 10,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  pickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppColors.fab.background,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  pickBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  imageWrapper: {
    width: 100,
    height: 100,
    borderRadius: 8,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  deleteBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: '#999',
    fontStyle: 'italic',
  },
});
