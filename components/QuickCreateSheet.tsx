import { useCallback, useMemo, useState } from 'react';
import { Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { BottomSheetModal, BottomSheetScrollView, BottomSheetTextInput } from '@gorhom/bottom-sheet';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useSQLiteContext } from 'expo-sqlite';
import * as ImagePicker from 'expo-image-picker';
import { AppColors, MONTHS } from '@/constants/theme';
import { NudgeControls } from './NudgeControls';
import { insertGrave } from '@/db/graves';
import { insertPerson } from '@/db/persons';
import { insertImage } from '@/db/images';
import { generateUUID } from '@/utils/uuid';
import { processCameraImage, saveGalleryImage } from '@/utils/images';
import { getImageProcessingMode } from '@/constants/storage';
import type { GraveType } from '@/db/types';

const GRAVE_TYPES: { label: string; value: GraveType }[] = [
  { label: 'Звичайна', value: 'REGULAR' },
  { label: 'Мала', value: 'SMALL' },
  { label: 'Подвійна', value: 'DOUBLE' },
  { label: 'Потрійна', value: 'TRIPLE' },
  { label: 'Дерево', value: 'TREE' },
  { label: 'Інше', value: 'OTHER' },
];

function MonthPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [visible, setVisible] = useState(false);
  const selected = MONTHS.find((m) => m.value === value);

  return (
    <>
      <TouchableOpacity
        style={[styles.input, styles.dateInput, styles.monthPicker]}
        onPress={() => setVisible(true)}
      >
        <Text style={value ? styles.monthText : styles.monthPlaceholder}>
          {selected?.label || 'Міс.'}
        </Text>
      </TouchableOpacity>
      <Modal visible={visible} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setVisible(false)}>
          <View style={styles.modalContent}>
            <ScrollView>
              {MONTHS.map((m) => (
                <TouchableOpacity
                  key={m.value}
                  style={[styles.monthOption, m.value === value && styles.monthOptionActive]}
                  onPress={() => {
                    onChange(m.value);
                    setVisible(false);
                  }}
                >
                  <Text style={[styles.monthOptionText, m.value === value && styles.monthOptionTextActive]}>
                    {m.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

interface PersonEntry {
  name: string;
  birth_day: string;
  birth_month: string;
  birth_year: string;
  death_day: string;
  death_month: string;
  death_year: string;
}

function emptyPerson(): PersonEntry {
  return { name: '', birth_day: '', birth_month: '', birth_year: '', death_day: '', death_month: '', death_year: '' };
}

interface QuickCreateSheetProps {
  bottomSheetRef: React.RefObject<BottomSheetModal | null>;
  latitude: number;
  longitude: number;
  type: GraveType;
  rotation: number;
  onTypeChange: (t: GraveType) => void;
  onRotationChange: (r: number) => void;
  onCoordsFromGPS: () => void;
  onCoordsChange: (lat: number, lng: number) => void;
  onCreated: () => void;
  onDismiss: () => void;
}

export function QuickCreateSheet({
  bottomSheetRef,
  latitude,
  longitude,
  type,
  rotation,
  onTypeChange,
  onRotationChange,
  onCoordsFromGPS,
  onCoordsChange,
  onCreated,
  onDismiss,
}: QuickCreateSheetProps) {
  const db = useSQLiteContext();
  const snapPoints = useMemo(() => ['60%', '85%'], []);

  const [persons, setPersons] = useState<PersonEntry[]>([]);
  const [notes, setNotes] = useState('');
  const [pickedPhotos, setPickedPhotos] = useState<{ uri: string; fromCamera: boolean }[]>([]);
  const [showNudge, setShowNudge] = useState(false);

  const nudge = useCallback(
    (dlat: number, dlng: number) => {
      onCoordsChange(latitude + dlat, longitude + dlng);
    },
    [latitude, longitude, onCoordsChange],
  );

  const resetForm = useCallback(() => {
    setPersons([]);
    setNotes('');
    setPickedPhotos([]);
    onDismiss();
  }, [onDismiss]);

  const updatePerson = useCallback((index: number, field: keyof PersonEntry, value: string) => {
    setPersons((prev) => prev.map((p, i) => (i === index ? { ...p, [field]: value } : p)));
  }, []);

  const addPerson = useCallback(() => {
    setPersons((prev) => [...prev, emptyPerson()]);
  }, []);

  const removePerson = useCallback((index: number) => {
    setPersons((prev) => prev.filter((_, i) => i !== index));
  }, []);

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
      setPickedPhotos((prev) => [...prev, { uri: result.assets[0].uri, fromCamera: true }]);
    }
  }, []);

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
      setPickedPhotos((prev) => [...prev, ...result.assets.map((a) => ({ uri: a.uri, fromCamera: false }))]);
    }
  }, []);

  const removePhoto = useCallback((index: number) => {
    setPickedPhotos((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleSave = useCallback(async () => {
    const graveId = generateUUID();
    const graveUid = generateUUID();
    const mode = await getImageProcessingMode();

    await insertGrave(db, {
      local_id: graveId,
      uid: graveUid,
      location: '',
      latitude,
      longitude,
      rotation,
      type,
      status: 'VISIBLE',
      notes,
    });

    for (const person of persons) {
      if (person.name.trim() || person.birth_year.trim() || person.death_year.trim()) {
        await insertPerson(db, {
          local_id: generateUUID(),
          grave_local_id: graveId,
          server_id: null,
          name: person.name.trim(),
          birth_day: person.birth_day.trim(),
          birth_month: person.birth_month.trim(),
          birth_year: person.birth_year.trim(),
          death_day: person.death_day.trim(),
          death_month: person.death_month.trim(),
          death_year: person.death_year.trim(),
          notes: '',
        });
      }
    }

    // Save photos now that the grave exists in DB
    for (const photo of pickedPhotos) {
      const imageId = generateUUID();
      const fileUri = photo.fromCamera
        ? await processCameraImage(photo.uri, imageId, graveUid, mode)
        : await saveGalleryImage(photo.uri, imageId, graveUid, mode);

      await insertImage(db, {
        local_id: imageId,
        grave_local_id: graveId,
        server_id: null,
        file_uri: fileUri,
        full_uri: fileUri,
        upload_status: mode === 'store_only' ? 'store_only' : 'pending',
      });
    }

    resetForm();
    bottomSheetRef.current?.dismiss();
    onCreated();
  }, [db, latitude, longitude, rotation, type, notes, persons, pickedPhotos, resetForm, bottomSheetRef, onCreated]);

  return (
    <BottomSheetModal
      ref={bottomSheetRef}
      snapPoints={snapPoints}
      enableDynamicSizing={false}
      onDismiss={resetForm}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
    >
      <BottomSheetScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Нова могила</Text>
        <View style={styles.coordsRow}>
          <Text style={styles.coords}>
            {latitude.toFixed(6)}, {longitude.toFixed(6)}
          </Text>
          <View style={styles.coordsBtns}>
            <TouchableOpacity style={styles.gpsBtn} onPress={onCoordsFromGPS}>
              <MaterialIcons name="gps-fixed" size={16} color="#fff" />
              <Text style={styles.gpsBtnText}>GPS</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.gpsBtn, showNudge && styles.nudgeToggleActive]}
              onPress={() => setShowNudge((v) => !v)}
            >
              <MaterialIcons name="open-with" size={16} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {showNudge && <NudgeControls onNudge={nudge} />}

        <Text style={styles.label}>Тип</Text>
        <View style={styles.typeRow}>
          {GRAVE_TYPES.map((t) => (
            <TouchableOpacity
              key={t.value}
              style={[styles.typeBtn, type === t.value && styles.typeBtnActive]}
              onPress={() => onTypeChange(t.value)}
            >
              <Text style={[styles.typeBtnText, type === t.value && styles.typeBtnTextActive]}>
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Поворот: {rotation}°</Text>
        <View style={styles.rotationRow}>
          <TouchableOpacity style={styles.rotBtn} onPress={() => onRotationChange(rotation - 5)}>
            <MaterialIcons name="rotate-left" size={20} color="#333" />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.rotBtn, rotation === -90 && styles.rotBtnActive]} onPress={() => onRotationChange(-90)}>
            <Text style={[styles.rotBtnText, rotation === -90 && styles.rotBtnTextActive]}>-90°</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.rotBtn, rotation === 0 && styles.rotBtnActive]} onPress={() => onRotationChange(0)}>
            <Text style={[styles.rotBtnText, rotation === 0 && styles.rotBtnTextActive]}>0°</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.rotBtn, rotation === 90 && styles.rotBtnActive]} onPress={() => onRotationChange(90)}>
            <Text style={[styles.rotBtnText, rotation === 90 && styles.rotBtnTextActive]}>90°</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.rotBtn} onPress={() => onRotationChange(rotation + 5)}>
            <MaterialIcons name="rotate-right" size={20} color="#333" />
          </TouchableOpacity>
        </View>

        {/* Persons */}
        <View style={styles.personsHeader}>
          <Text style={styles.label}>Поховані</Text>
          <TouchableOpacity style={styles.addPersonBtn} onPress={addPerson}>
            <MaterialIcons name="add" size={18} color="#fff" />
            <Text style={styles.addPersonBtnText}>Додати</Text>
          </TouchableOpacity>
        </View>

        {persons.map((person, index) => (
          <View key={index} style={styles.personCard}>
            <View style={styles.personHeader}>
              <Text style={styles.personIndex}>Особа {index + 1}</Text>
              <TouchableOpacity onPress={() => removePerson(index)}>
                <MaterialIcons name="close" size={20} color={AppColors.danger} />
              </TouchableOpacity>
            </View>
            <BottomSheetTextInput
              style={styles.input}
              value={person.name}
              onChangeText={(v) => updatePerson(index, 'name', v)}
              placeholder="Ім'я"
              placeholderTextColor={AppColors.placeholder}
              autoCapitalize="words"
            />
            <Text style={styles.dateLabel}>Народження</Text>
            <View style={styles.dateRow}>
              <BottomSheetTextInput
                style={[styles.input, styles.dateInput]}
                value={person.birth_day}
                onChangeText={(v) => updatePerson(index, 'birth_day', v)}
                placeholder="День"
                placeholderTextColor={AppColors.placeholder}
                keyboardType="numeric"
                maxLength={2}
              />
              <MonthPicker
                value={person.birth_month}
                onChange={(v) => updatePerson(index, 'birth_month', v)}
              />
              <BottomSheetTextInput
                style={[styles.input, styles.yearInput]}
                value={person.birth_year}
                onChangeText={(v) => updatePerson(index, 'birth_year', v)}
                placeholder="Рік"
                placeholderTextColor={AppColors.placeholder}
                keyboardType="numeric"
                maxLength={4}
              />
            </View>
            <Text style={styles.dateLabel}>Смерть</Text>
            <View style={styles.dateRow}>
              <BottomSheetTextInput
                style={[styles.input, styles.dateInput]}
                value={person.death_day}
                onChangeText={(v) => updatePerson(index, 'death_day', v)}
                placeholder="День"
                placeholderTextColor={AppColors.placeholder}
                keyboardType="numeric"
                maxLength={2}
              />
              <MonthPicker
                value={person.death_month}
                onChange={(v) => updatePerson(index, 'death_month', v)}
              />
              <BottomSheetTextInput
                style={[styles.input, styles.yearInput]}
                value={person.death_year}
                onChangeText={(v) => updatePerson(index, 'death_year', v)}
                placeholder="Рік"
                placeholderTextColor={AppColors.placeholder}
                keyboardType="numeric"
                maxLength={4}
              />
            </View>
          </View>
        ))}

        {/* Photos */}
        <Text style={styles.label}>Фотографії</Text>
        <View style={styles.photoButtonRow}>
          <TouchableOpacity style={styles.photoBtn} onPress={pickFromCamera}>
            <MaterialIcons name="camera-alt" size={20} color="#fff" />
            <Text style={styles.photoBtnText}>Камера</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.photoBtn} onPress={pickFromGallery}>
            <MaterialIcons name="photo-library" size={20} color="#fff" />
            <Text style={styles.photoBtnText}>Галерея</Text>
          </TouchableOpacity>
        </View>
        {pickedPhotos.length > 0 && (
          <View style={styles.photoGrid}>
            {pickedPhotos.map((photo, index) => (
              <View key={photo.uri} style={styles.photoWrapper}>
                <Image source={{ uri: photo.uri }} style={styles.photoThumb} />
                <TouchableOpacity style={styles.photoDeleteBtn} onPress={() => removePhoto(index)}>
                  <MaterialIcons name="close" size={16} color="#fff" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        <Text style={styles.label}>Нотатки</Text>
        <BottomSheetTextInput
          style={[styles.input, styles.multiline]}
          value={notes}
          onChangeText={setNotes}
          placeholder="Додаткова інформація..."
          placeholderTextColor={AppColors.placeholder}
          multiline
        />

        <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
          <Text style={styles.saveBtnText}>Зберегти</Text>
        </TouchableOpacity>
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  coordsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  coords: {
    fontSize: 13,
    color: '#777',
  },
  gpsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppColors.fab.background,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    gap: 4,
  },
  gpsBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  coordsBtns: {
    flexDirection: 'row',
    gap: 8,
  },
  nudgeToggleActive: {
    backgroundColor: AppColors.success,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 6,
    color: '#333',
  },
  typeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: AppColors.inputBorder,
  },
  typeBtnActive: {
    backgroundColor: AppColors.fab.background,
    borderColor: AppColors.fab.background,
  },
  typeBtnText: {
    fontSize: 13,
    color: '#333',
  },
  typeBtnTextActive: {
    color: '#fff',
  },
  rotationRow: {
    flexDirection: 'row',
    gap: 12,
  },
  rotBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#e8e8e8',
  },
  rotBtnSmall: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#efefef',
  },
  rotBtnActive: {
    backgroundColor: AppColors.fab.background,
  },
  rotBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  rotBtnTextActive: {
    color: '#fff',
  },
  personsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  addPersonBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppColors.fab.background,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    gap: 4,
  },
  addPersonBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  personCard: {
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  personHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  personIndex: {
    fontSize: 13,
    fontWeight: '700',
    color: '#555',
  },
  dateLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
    marginTop: 2,
  },
  dateRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 6,
  },
  dateInput: {
    flex: 1,
    marginBottom: 0,
  },
  yearInput: {
    flex: 1.5,
    marginBottom: 0,
  },
  input: {
    borderWidth: 1,
    borderColor: AppColors.inputBorder,
    borderRadius: 8,
    padding: 10,
    fontSize: 15,
    marginBottom: 6,
    backgroundColor: '#fff',
  },
  multiline: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
  photoButtonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  photoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppColors.fab.background,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  photoBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  photoWrapper: {
    width: 100,
    height: 100,
    borderRadius: 8,
    overflow: 'hidden',
  },
  photoThumb: {
    width: '100%',
    height: '100%',
  },
  photoDeleteBtn: {
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
  saveBtn: {
    backgroundColor: AppColors.success,
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 20,
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  monthPicker: {
    justifyContent: 'center',
    marginBottom: 0,
  },
  monthText: {
    fontSize: 15,
    color: '#333',
  },
  monthPlaceholder: {
    fontSize: 15,
    color: AppColors.placeholder,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    width: 250,
    maxHeight: 400,
    paddingVertical: 8,
  },
  monthOption: {
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  monthOptionActive: {
    backgroundColor: AppColors.fab.background,
  },
  monthOptionText: {
    fontSize: 16,
    color: '#333',
  },
  monthOptionTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
});
