import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSQLiteContext } from 'expo-sqlite';
import { STORAGE_KEYS, getImageProcessingMode } from '@/constants/storage';
import { getPendingGraves } from '@/db/graves';
import { getPendingImages } from '@/db/images';
import { runStoreAndSendLoop, runStoreOnlyLoop, type SyncActivity } from '@/services/background-sync';

interface SyncContextValue {
  backgroundSyncEnabled: boolean;
  setBackgroundSyncEnabled: (v: boolean) => void;
  isRunning: boolean;
  activity: SyncActivity;
  pendingGraves: number;
  pendingImages: number;
  totalGraves: number;
  totalImages: number;
  nextSyncIn: number; // seconds until next sync cycle, 0 if not sleeping
  refreshCounts: () => Promise<void>;
}

const SyncContext = createContext<SyncContextValue | null>(null);

export function useSyncContext(): SyncContextValue {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error('useSyncContext must be used within SyncProvider');
  return ctx;
}

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const db = useSQLiteContext();
  const [enabled, setEnabled] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [activity, setActivity] = useState<SyncActivity>('idle');
  const [pendingGraves, setPendingGraves] = useState(0);
  const [pendingImages, setPendingImages] = useState(0);
  const [totalGraves, setTotalGraves] = useState(0);
  const [totalImages, setTotalImages] = useState(0);
  const [sleepUntil, setSleepUntil] = useState(0);
  const [nextSyncIn, setNextSyncIn] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const countIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refreshCounts = useCallback(async () => {
    try {
      const graves = await getPendingGraves(db);
      const images = await getPendingImages(db);
      setPendingGraves(graves.length);
      setPendingImages(images.length);

      const totalG = await db.getFirstAsync<{ count: number }>(
        "SELECT COUNT(*) as count FROM local_graves WHERE sync_status != 'deleted'"
      );
      setTotalGraves(totalG?.count ?? 0);

      const totalI = await db.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) as count FROM local_grave_images'
      );
      setTotalImages(totalI?.count ?? 0);
    } catch {
      // DB may not be ready yet
    }
  }, [db]);

  // Load initial state
  useEffect(() => {
    (async () => {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.BACKGROUND_SYNC_ENABLED);
      if (stored === 'true') setEnabled(true);
      await refreshCounts();
    })();
  }, [refreshCounts]);

  // Periodic count refresh (every 10s) regardless of bg sync state
  useEffect(() => {
    countIntervalRef.current = setInterval(refreshCounts, 10_000);
    return () => {
      if (countIntervalRef.current) clearInterval(countIntervalRef.current);
    };
  }, [refreshCounts]);

  // Countdown timer for next sync
  useEffect(() => {
    if (!sleepUntil) { setNextSyncIn(0); return; }
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((sleepUntil - Date.now()) / 1000));
      setNextSyncIn(remaining);
      if (remaining === 0) setSleepUntil(0);
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [sleepUntil]);

  // Start/stop loop when enabled changes
  useEffect(() => {
    if (!enabled) {
      if (abortRef.current) {
        abortRef.current.abort();
        abortRef.current = null;
      }
      setIsRunning(false);
      setActivity('idle');
      return;
    }

    let cancelled = false;

    (async () => {
      const serverUrl = await AsyncStorage.getItem(STORAGE_KEYS.SERVER_URL);
      const authToken = await AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);

      if (!serverUrl || cancelled) return;

      const imageMode = await getImageProcessingMode();

      // Abort any existing loop
      if (abortRef.current) abortRef.current.abort();

      const controller = new AbortController();
      abortRef.current = controller;
      setIsRunning(true);

      const onUpdate = (update: { activity: SyncActivity; pendingGraves: number; pendingImages: number; sleepUntil?: number }) => {
        setActivity(update.activity);
        setPendingGraves(update.pendingGraves);
        setPendingImages(update.pendingImages);
        if (update.sleepUntil) {
          setSleepUntil(update.sleepUntil);
        } else {
          setSleepUntil(0);
        }
      };

      const loopFn = imageMode === 'store_only' ? runStoreOnlyLoop : runStoreAndSendLoop;

      try {
        await loopFn(db, serverUrl, authToken ?? '', controller.signal, onUpdate);
      } finally {
        if (abortRef.current === controller) {
          setIsRunning(false);
          setActivity('idle');
        }
      }
    })();

    return () => {
      cancelled = true;
      if (abortRef.current) {
        abortRef.current.abort();
        abortRef.current = null;
      }
    };
  }, [enabled, db]);

  const setBackgroundSyncEnabled = useCallback(async (v: boolean) => {
    setEnabled(v);
    await AsyncStorage.setItem(STORAGE_KEYS.BACKGROUND_SYNC_ENABLED, v ? 'true' : 'false');
  }, []);

  return (
    <SyncContext.Provider
      value={{
        backgroundSyncEnabled: enabled,
        setBackgroundSyncEnabled,
        isRunning,
        activity,
        pendingGraves,
        pendingImages,
        totalGraves,
        totalImages,
        nextSyncIn,
        refreshCounts,
      }}
    >
      {children}
    </SyncContext.Provider>
  );
}
