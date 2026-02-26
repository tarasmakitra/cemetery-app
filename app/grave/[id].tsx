import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as Location from 'expo-location';

import { graveFormSchema, type GraveFormData } from '@/db/schemas';
import { getGraveById, insertGrave, updateGrave, deleteGrave } from '@/db/graves';
import { insertPerson, deletePersonsByGraveId } from '@/db/persons';
import { getImagesByGraveId } from '@/db/images';
import { generateUUID } from '@/utils/uuid';
import { PersonFields } from '@/components/PersonFields';
import { GraveImagePicker } from '@/components/GraveImagePicker';
import { AppColors, DEFAULT_ROTATION } from '@/constants/theme';
import { snapToGrid } from '@/utils/snap';
import type { LocalGraveImage, GraveType } from '@/db/types';

const GRAVE_TYPES: { label: string; value: GraveType }[] = [
  { label: 'Звичайна', value: 'REGULAR' },
  { label: 'Мала', value: 'SMALL' },
  { label: 'Подвійна', value: 'DOUBLE' },
  { label: 'Потрійна', value: 'TRIPLE' },
  { label: 'Дерево', value: 'TREE' },
  { label: 'Інше', value: 'OTHER' },
];

const STATUS_OPTIONS: { label: string; value: 'VISIBLE' | 'HIDDEN' }[] = [
  { label: 'Видима', value: 'VISIBLE' },
  { label: 'Прихована', value: 'HIDDEN' },
];

export default function GraveFormScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const graveLocalId = isNew ? generateUUID() : id;

  const db = useSQLiteContext();
  const router = useRouter();
  const navigation = useNavigation();
  const [images, setImages] = useState<LocalGraveImage[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [uid, setUid] = useState<string>(isNew ? generateUUID() : '');

  const { control, handleSubmit, reset, setValue, watch } = useForm<GraveFormData>({
    resolver: zodResolver(graveFormSchema) as any,
    defaultValues: {
      status: 'VISIBLE',
      type: 'REGULAR',
      location: '',
      latitude: 0,
      longitude: 0,
      rotation: DEFAULT_ROTATION,
      notes: '',
      persons: [],
    },
  });

  const currentType = watch('type');
  const currentStatus = watch('status');
  const currentRotation = watch('rotation');

  useEffect(() => {
    navigation.setOptions({
      title: isNew ? 'Нова могила' : 'Редагування',
    });
  }, [isNew, navigation]);

  useEffect(() => {
    if (!isNew && id) {
      (async () => {
        const grave = await getGraveById(db, id);
        if (grave) {
          reset({
            status: grave.status,
            type: grave.type,
            location: grave.location,
            latitude: grave.latitude,
            longitude: grave.longitude,
            rotation: grave.rotation,
            notes: grave.notes,
            persons: grave.persons.map((p) => ({
              local_id: p.local_id,
              name: p.name,
              birth_day: p.birth_day,
              birth_month: p.birth_month,
              birth_year: p.birth_year,
              death_day: p.death_day,
              death_month: p.death_month,
              death_year: p.death_year,
              notes: p.notes,
            })),
          });
          setImages(grave.images);
          setUid(grave.uid);
        }
        setLoaded(true);
      })();
    } else {
      setLoaded(true);
    }
  }, [db, id, isNew, reset]);

  const loadImages = useCallback(async () => {
    if (graveLocalId) {
      const imgs = await getImagesByGraveId(db, graveLocalId);
      setImages(imgs);
    }
  }, [db, graveLocalId]);

  const handleGPS = useCallback(async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Помилка', 'Потрібен доступ до GPS');
      return;
    }
    const loc = await Location.getCurrentPositionAsync({});
    const snapped = snapToGrid(loc.coords.latitude, loc.coords.longitude);
    setValue('latitude', snapped.latitude);
    setValue('longitude', snapped.longitude);
  }, [setValue]);

  const onSubmit = useCallback(async (data: GraveFormData) => {
    try {
      if (isNew) {
        await insertGrave(db, {
          local_id: graveLocalId,
          uid,
          location: data.location,
          latitude: data.latitude,
          longitude: data.longitude,
          rotation: data.rotation,
          type: data.type,
          status: data.status,
          notes: data.notes,
        });
      } else {
        await updateGrave(db, graveLocalId, {
          location: data.location,
          latitude: data.latitude,
          longitude: data.longitude,
          rotation: data.rotation,
          type: data.type,
          status: data.status,
          notes: data.notes,
        });
      }

      // Re-save persons: delete all, re-insert
      await deletePersonsByGraveId(db, graveLocalId);
      for (const person of data.persons) {
        await insertPerson(db, {
          local_id: person.local_id || generateUUID(),
          grave_local_id: graveLocalId,
          server_id: null,
          name: person.name,
          birth_day: person.birth_day,
          birth_month: person.birth_month,
          birth_year: person.birth_year,
          death_day: person.death_day,
          death_month: person.death_month,
          death_year: person.death_year,
          notes: person.notes,
        });
      }

      router.back();
    } catch (err) {
      Alert.alert('Помилка', 'Не вдалося зберегти');
    }
  }, [db, graveLocalId, isNew, router]);

  const handleDelete = useCallback(() => {
    Alert.alert('Видалити могилу?', 'Цю дію не можна скасувати.', [
      { text: 'Скасувати', style: 'cancel' },
      {
        text: 'Видалити',
        style: 'destructive',
        onPress: async () => {
          await deleteGrave(db, graveLocalId);
          router.back();
        },
      },
    ]);
  }, [db, graveLocalId, router]);

  if (!loaded) return null;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior="padding"
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 80}
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        {uid ? <Text style={styles.uidLabel}>UID: {uid}</Text> : null}

        {/* Status */}
        {/*<Text style={styles.label}>Статус</Text>*/}
        {/*<View style={styles.toggleRow}>*/}
        {/*  {STATUS_OPTIONS.map((opt) => (*/}
        {/*    <TouchableOpacity*/}
        {/*      key={opt.value}*/}
        {/*      style={[styles.toggleBtn, currentStatus === opt.value && styles.toggleBtnActive]}*/}
        {/*      onPress={() => setValue('status', opt.value)}*/}
        {/*    >*/}
        {/*      <Text style={[styles.toggleText, currentStatus === opt.value && styles.toggleTextActive]}>*/}
        {/*        {opt.label}*/}
        {/*      </Text>*/}
        {/*    </TouchableOpacity>*/}
        {/*  ))}*/}
        {/*</View>*/}

        {/* Location */}
        {/*<Text style={styles.label}>Розташування</Text>*/}
        {/*<Controller*/}
        {/*  control={control}*/}
        {/*  name="location"*/}
        {/*  render={({ field }) => (*/}
        {/*    <TextInput*/}
        {/*      style={styles.input}*/}
        {/*      value={field.value}*/}
        {/*      onChangeText={field.onChange}*/}
        {/*      placeholder="Напр. A8, H24"*/}
        {/*      placeholderTextColor={AppColors.placeholder}*/}
        {/*    />*/}
        {/*  )}*/}
        {/*/>*/}

        {/* Type */}
        <Text style={styles.label}>Тип</Text>
        <View style={styles.typeRow}>
          {GRAVE_TYPES.map((t) => (
            <TouchableOpacity
              key={t.value}
              style={[styles.toggleBtn, currentType === t.value && styles.toggleBtnActive]}
              onPress={() => setValue('type', t.value)}
            >
              <Text style={[styles.toggleText, currentType === t.value && styles.toggleTextActive]}>
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Coordinates */}
        {/*<Text style={styles.label}>Координати</Text>*/}
        {/*<View style={styles.coordRow}>*/}
        {/*  <Controller*/}
        {/*    control={control}*/}
        {/*    name="latitude"*/}
        {/*    render={({ field }) => (*/}
        {/*      <TextInput*/}
        {/*        style={[styles.input, styles.coordInput]}*/}
        {/*        value={field.value ? String(field.value) : ''}*/}
        {/*        onChangeText={(t) => field.onChange(parseFloat(t) || 0)}*/}
        {/*        placeholder="Широта"*/}
        {/*        placeholderTextColor={AppColors.placeholder}*/}
        {/*        keyboardType="numeric"*/}
        {/*      />*/}
        {/*    )}*/}
        {/*  />*/}
        {/*  <Controller*/}
        {/*    control={control}*/}
        {/*    name="longitude"*/}
        {/*    render={({ field }) => (*/}
        {/*      <TextInput*/}
        {/*        style={[styles.input, styles.coordInput]}*/}
        {/*        value={field.value ? String(field.value) : ''}*/}
        {/*        onChangeText={(t) => field.onChange(parseFloat(t) || 0)}*/}
        {/*        placeholder="Довгота"*/}
        {/*        placeholderTextColor={AppColors.placeholder}*/}
        {/*        keyboardType="numeric"*/}
        {/*      />*/}
        {/*    )}*/}
        {/*  />*/}
        {/*  <TouchableOpacity style={styles.gpsBtn} onPress={handleGPS}>*/}
        {/*    <Text style={styles.gpsBtnText}>GPS</Text>*/}
        {/*  </TouchableOpacity>*/}
        {/*</View>*/}

        {/* Rotation */}
        <Text style={styles.label}>Поворот: {currentRotation}°</Text>
        <View style={styles.rotationRow}>
          <TouchableOpacity style={styles.rotBtn} onPress={() => setValue('rotation', currentRotation - 5)}>
            <MaterialIcons name="rotate-left" size={20} color="#333" />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.rotBtn, currentRotation === -90 && styles.rotBtnActive]} onPress={() => setValue('rotation', -90)}>
            <Text style={[styles.rotBtnText, currentRotation === -90 && styles.rotBtnTextActive]}>-90°</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.rotBtn, currentRotation === 0 && styles.rotBtnActive]} onPress={() => setValue('rotation', 0)}>
            <Text style={[styles.rotBtnText, currentRotation === 0 && styles.rotBtnTextActive]}>0°</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.rotBtn, currentRotation === 90 && styles.rotBtnActive]} onPress={() => setValue('rotation', 90)}>
            <Text style={[styles.rotBtnText, currentRotation === 90 && styles.rotBtnTextActive]}>90°</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.rotBtn} onPress={() => setValue('rotation', currentRotation + 5)}>
            <MaterialIcons name="rotate-right" size={20} color="#333" />
          </TouchableOpacity>
          <Controller
            control={control}
            name="rotation"
            render={({ field }) => (
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={String(field.value)}
                onChangeText={(t) => field.onChange(parseFloat(t) || 0)}
                keyboardType="numeric"
              />
            )}
          />
        </View>

        {/* Persons */}
        <PersonFields control={control} />

        {/* Images */}
        {(!isNew || graveLocalId) && (
          <GraveImagePicker
            graveLocalId={graveLocalId}
            graveUid={uid}
            images={images}
            onImagesChanged={loadImages}
          />
        )}

        {/* Notes */}
        <Text style={[styles.label, { marginTop: 20 }]}>Нотатки</Text>
        <Controller
          control={control}
          name="notes"
          render={({ field }) => (
            <TextInput
              style={[styles.input, styles.multiline]}
              value={field.value}
              onChangeText={field.onChange}
              placeholder="Додаткова інформація..."
              placeholderTextColor={AppColors.placeholder}
              multiline
            />
          )}
        />

        {/* Actions */}
        <TouchableOpacity style={styles.saveBtn} onPress={handleSubmit(onSubmit)}>
          <Text style={styles.saveBtnText}>Зберегти</Text>
        </TouchableOpacity>

        {!isNew && (
          <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
            <Text style={styles.deleteBtnText}>Видалити могилу</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scroll: {
    padding: 16,
    paddingBottom: 40,
  },
  uidLabel: {
    fontSize: 11,
    color: '#999',
    marginBottom: 4,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 14,
    marginBottom: 6,
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: AppColors.inputBorder,
    borderRadius: 8,
    padding: 10,
    fontSize: 15,
  },
  multiline: {
    minHeight: 70,
    textAlignVertical: 'top',
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 8,
  },
  typeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  toggleBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: AppColors.inputBorder,
  },
  toggleBtnActive: {
    backgroundColor: AppColors.fab.background,
    borderColor: AppColors.fab.background,
  },
  toggleText: {
    fontSize: 13,
    color: '#333',
  },
  toggleTextActive: {
    color: '#fff',
  },
  coordRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  coordInput: {
    flex: 1,
  },
  gpsBtn: {
    backgroundColor: AppColors.fab.background,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
  },
  gpsBtnText: {
    color: '#fff',
    fontWeight: '700',
  },
  rotationRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
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
  saveBtn: {
    backgroundColor: AppColors.success,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 24,
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  deleteBtn: {
    backgroundColor: AppColors.danger,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  deleteBtnText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
});
