import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { useSQLiteContext } from 'expo-sqlite';

import { Directory } from 'expo-file-system';

import { getPendingGraves } from '@/db/graves';
import { getPendingImages } from '@/db/images';
import { syncAll, pullFromServer, type SyncProgress } from '@/services/sync';
import { AppColors } from '@/constants/theme';
import { STORAGE_KEYS } from '@/constants/storage';
import type { ImageProcessingMode, LocalGrave, LocalGravePerson } from '@/db/types';

export default function SyncScreen() {
  const db = useSQLiteContext();
  const [pendingGraves, setPendingGraves] = useState(0);
  const [pendingImages, setPendingImages] = useState(0);
  const [serverUrl, setServerUrl] = useState('');
  const [authToken, setAuthToken] = useState('');
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null);
  const [pulling, setPulling] = useState(false);
  const [pullProgress, setPullProgress] = useState('');
  const [totalGraves, setTotalGraves] = useState(0);
  const [imageMode, setImageMode] = useState<ImageProcessingMode>('store_and_send');
  const [exporting, setExporting] = useState(false);

  const loadStats = useCallback(async () => {
    const graves = await getPendingGraves(db);
    setPendingGraves(graves.length);

    const images = await getPendingImages(db);
    setPendingImages(images.length);

    const allGraves = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM local_graves'
    );
    setTotalGraves(allGraves?.count ?? 0);

    const url = await AsyncStorage.getItem(STORAGE_KEYS.SERVER_URL);
    const token = await AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
    const sync = await AsyncStorage.getItem(STORAGE_KEYS.LAST_SYNC);

    const mode = await AsyncStorage.getItem(STORAGE_KEYS.IMAGE_MODE);
    if (mode === 'store_only' || mode === 'store_and_send') setImageMode(mode);

    if (url) setServerUrl(url);
    if (token) setAuthToken(token);
    setLastSync(sync);
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      loadStats();
    }, [loadStats])
  );

  const changeImageMode = useCallback(async (mode: ImageProcessingMode) => {
    setImageMode(mode);
    await AsyncStorage.setItem(STORAGE_KEYS.IMAGE_MODE, mode);
  }, []);

  const saveSettings = useCallback(async () => {
    await AsyncStorage.setItem(STORAGE_KEYS.SERVER_URL, serverUrl);
    await AsyncStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, authToken);
    Alert.alert('Збережено', 'Налаштування збережено');
  }, [serverUrl, authToken]);

  const handleSync = useCallback(async () => {
    if (!serverUrl.trim()) {
      Alert.alert('Помилка', 'Вкажіть URL сервера');
      return;
    }
    setSyncing(true);
    setSyncProgress(null);
    try {
      await syncAll(db, serverUrl, authToken, setSyncProgress);
      await AsyncStorage.setItem(STORAGE_KEYS.LAST_SYNC, new Date().toISOString());
      await loadStats();
      Alert.alert('Успіх', 'Синхронізацію завершено');
    } catch (err) {
      Alert.alert('Помилка', `Синхронізація не вдалася: ${err}`);
    } finally {
      setSyncing(false);
      setSyncProgress(null);
    }
  }, [db, serverUrl, authToken, loadStats]);

  const handlePull = useCallback(async () => {
    if (!serverUrl.trim()) {
      Alert.alert('Помилка', 'Вкажіть URL сервера');
      return;
    }
    setPulling(true);
    setPullProgress('');
    try {
      const result = await pullFromServer(db, serverUrl, authToken, (fetched, total) => {
        setPullProgress(`${fetched} / ${total}`);
      });
      await loadStats();
      Alert.alert(
        'Успіх',
        `Завантажено з сервера:\nНових: ${result.created}\nОновлено: ${result.updated}\nПропущено (є локальні зміни): ${result.skipped}`
      );
    } catch (err) {
      Alert.alert('Помилка', `Не вдалося завантажити: ${err}`);
    } finally {
      setPulling(false);
      setPullProgress('');
    }
  }, [db, serverUrl, authToken, loadStats]);

  const handleExportJson = useCallback(async () => {
    setExporting(true);
    try {
      const graves = await db.getAllAsync<LocalGrave>(
        'SELECT * FROM local_graves WHERE sync_status != ?',
        ['deleted']
      );
      const persons = await db.getAllAsync<LocalGravePerson>(
        'SELECT * FROM local_grave_persons'
      );

      const personsByGrave = new Map<string, LocalGravePerson[]>();
      for (const p of persons) {
        const list = personsByGrave.get(p.grave_local_id) ?? [];
        list.push(p);
        personsByGrave.set(p.grave_local_id, list);
      }

      const data = graves.map((g, idx) => {
        const gravePersons = personsByGrave.get(g.local_id) ?? [];
        return {
          id: g.server_id ?? idx + 1,
          uid: g.uid,
          status: g.status,
          type: g.type,
          location: g.location || null,
          rotation: g.rotation,
          latitude: g.latitude || null,
          longitude: g.longitude || null,
          notes: g.notes || null,
          createdAt: g.created_at,
          updatedAt: g.updated_at,
          persons: gravePersons.map((p, pIdx) => ({
            id: p.server_id ?? pIdx + 1,
            name: p.name,
            birthDay: p.birth_day,
            birthMonth: p.birth_month,
            birthYear: p.birth_year,
            deathDay: p.death_day,
            deathMonth: p.death_month,
            deathYear: p.death_year,
            notes: p.notes,
            order: pIdx,
            createdAt: p.created_at,
          })),
        };
      });

      const json = JSON.stringify(data, null, 2);

      const now = new Date();
      const date = now.toISOString().slice(0, 10).replace(/-/g, '');
      const time = now.toTimeString().slice(0, 8).replace(/:/g, '');
      const fileName = `cemetery-${date}-${time}.json`;

      const dir = await Directory.pickDirectoryAsync();
      const savedFile = dir.createFile(fileName, 'application/json');
      savedFile.write(json);

      Alert.alert('Успіх', `Файл ${fileName} збережено`);
    } catch (err) {
      Alert.alert('Помилка', `Не вдалося експортувати: ${err}`);
    } finally {
      setExporting(false);
    }
  }, [db]);

  const handleClearData = useCallback(() => {
    Alert.alert(
      'Очистити всі дані?',
      'Всі локальні дані будуть видалені. Цю дію не можна скасувати.',
      [
        { text: 'Скасувати', style: 'cancel' },
        {
          text: 'Очистити',
          style: 'destructive',
          onPress: async () => {
            await db.execAsync(`
              DELETE FROM local_grave_images;
              DELETE FROM local_grave_persons;
              DELETE FROM local_graves;
            `);
            await loadStats();
            Alert.alert('Готово', 'Всі дані видалено');
          },
        },
      ]
    );
  }, [db, loadStats]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Stats */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Статистика</Text>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Всього могил:</Text>
          <Text style={styles.statValue}>{totalGraves}</Text>
        </View>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Очікують синхронізації:</Text>
          <Text style={[styles.statValue, pendingGraves > 0 && { color: AppColors.warning }]}>
            {pendingGraves}
          </Text>
        </View>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Фото для завантаження:</Text>
          <Text style={[styles.statValue, pendingImages > 0 && { color: AppColors.warning }]}>
            {pendingImages}
          </Text>
        </View>
        {lastSync && (
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Остання синхронізація:</Text>
            <Text style={styles.statValue}>
              {new Date(lastSync).toLocaleString('uk-UA')}
            </Text>
          </View>
        )}
      </View>

      {/* Sync button */}
      <TouchableOpacity
        style={[styles.syncBtn, syncing && styles.syncBtnDisabled]}
        onPress={handleSync}
        disabled={syncing}
      >
        <Text style={styles.syncBtnText}>
          {syncing ? 'Синхронізація...' : 'Синхронізувати зараз'}
        </Text>
      </TouchableOpacity>

      {syncing && syncProgress && (
        <View style={styles.progressCard}>
          {syncProgress.phase === 'images' && (
            <>
              <Text style={styles.progressText}>
                Завантаження фото: {syncProgress.imagesCurrent} / {syncProgress.imagesTotal}
              </Text>
              <View style={styles.progressBarBg}>
                <View style={[styles.progressBarFill, { width: `${(syncProgress.imagesCurrent / syncProgress.imagesTotal) * 100}%` }]} />
              </View>
              {syncProgress.gravesTotal > 0 && (
                <Text style={styles.progressSubText}>
                  Потім: синхронізація {syncProgress.gravesTotal} записів
                </Text>
              )}
            </>
          )}
          {syncProgress.phase === 'graves' && (
            <Text style={styles.progressText}>
              Синхронізація {syncProgress.gravesTotal} записів...
              {syncProgress.imagesTotal > 0 && ` (фото: ${syncProgress.imagesTotal} завантажено)`}
            </Text>
          )}
        </View>
      )}

      {/* Pull from server */}
      <TouchableOpacity
        style={[styles.pullBtn, pulling && styles.syncBtnDisabled]}
        onPress={handlePull}
        disabled={pulling}
      >
        <Text style={styles.syncBtnText}>
          {pulling
            ? pullProgress
              ? `Завантаження... ${pullProgress}`
              : 'Завантаження...'
            : 'Завантажити з сервера'}
        </Text>
      </TouchableOpacity>

      {/* Export JSON */}
      <TouchableOpacity
        style={[styles.exportBtn, exporting && styles.syncBtnDisabled]}
        onPress={handleExportJson}
        disabled={exporting}
      >
        {exporting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.syncBtnText}>Завантажити JSON дані</Text>
        )}
      </TouchableOpacity>

      {/* Image mode */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Режим обробки фото</Text>
        <View style={styles.modeRow}>
          <TouchableOpacity
            style={[styles.modeBtn, imageMode === 'store_only' && styles.modeBtnActive]}
            onPress={() => changeImageMode('store_only')}
          >
            <Text style={[styles.modeBtnText, imageMode === 'store_only' && styles.modeBtnTextActive]}>
              Тільки зберігати
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeBtn, imageMode === 'store_and_send' && styles.modeBtnActive]}
            onPress={() => changeImageMode('store_and_send')}
          >
            <Text style={[styles.modeBtnText, imageMode === 'store_and_send' && styles.modeBtnTextActive]}>
              Зберігати і надсилати
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Settings */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Налаштування сервера</Text>

        <Text style={styles.label}>URL сервера</Text>
        <TextInput
          style={styles.input}
          value={serverUrl}
          onChangeText={setServerUrl}
          placeholder="https://api.example.com"
          placeholderTextColor={AppColors.placeholder}
          autoCapitalize="none"
          keyboardType="url"
        />

        <Text style={styles.label}>Токен авторизації</Text>
        <TextInput
          style={styles.input}
          value={authToken}
          onChangeText={setAuthToken}
          placeholder="Bearer token..."
          placeholderTextColor={AppColors.placeholder}
          autoCapitalize="none"
          secureTextEntry
        />

        <TouchableOpacity style={styles.saveBtn} onPress={saveSettings}>
          <Text style={styles.saveBtnText}>Зберегти налаштування</Text>
        </TouchableOpacity>
      </View>

      {/* Danger zone */}
      <View style={[styles.card, styles.dangerCard]}>
        <Text style={styles.cardTitle}>Небезпечна зона</Text>
        <TouchableOpacity style={styles.clearBtn} onPress={handleClearData}>
          <Text style={styles.clearBtnText}>Очистити всі локальні дані</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  dangerCard: {
    borderWidth: 1,
    borderColor: AppColors.danger,
    backgroundColor: '#fff5f5',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  statLabel: {
    fontSize: 14,
    color: '#555',
  },
  statValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  syncBtn: {
    backgroundColor: AppColors.fab.background,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  pullBtn: {
    backgroundColor: AppColors.success,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  exportBtn: {
    backgroundColor: '#6c757d',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  syncBtnDisabled: {
    opacity: 0.6,
  },
  syncBtnText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 10,
    marginBottom: 6,
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: AppColors.inputBorder,
    borderRadius: 8,
    padding: 10,
    fontSize: 15,
    backgroundColor: '#fff',
    color: '#000',
  },
  saveBtn: {
    backgroundColor: AppColors.success,
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 14,
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  clearBtn: {
    backgroundColor: AppColors.danger,
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  clearBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  modeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: AppColors.inputBorder,
    alignItems: 'center',
  },
  modeBtnActive: {
    backgroundColor: AppColors.fab.background,
    borderColor: AppColors.fab.background,
  },
  modeBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },
  modeBtnTextActive: {
    color: '#fff',
  },
  progressCard: {
    backgroundColor: '#e8f4fd',
    borderRadius: 12,
    padding: 14,
    marginTop: -8,
    marginBottom: 16,
  },
  progressText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
  },
  progressSubText: {
    fontSize: 12,
    color: '#777',
    marginTop: 4,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: '#ccc',
    borderRadius: 3,
    overflow: 'hidden' as const,
  },
  progressBarFill: {
    height: 6,
    backgroundColor: AppColors.fab.background,
    borderRadius: 3,
  },
});
