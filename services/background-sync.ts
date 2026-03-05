import type { SQLiteDatabase } from 'expo-sqlite';
import { getPendingGraves } from '@/db/graves';
import { getPendingImages } from '@/db/images';
import { syncGraveBatch, uploadSingleImage } from './sync';

export type SyncActivity =
  | 'idle'
  | 'syncing_graves'
  | { uploading: number; total: number }
  | 'error';

export interface SyncUpdate {
  activity: SyncActivity;
  pendingGraves: number;
  pendingImages: number;
  sleepUntil?: number; // Date.now() + ms when sleeping
}

function abortableSleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) { resolve(); return; }
    const timer = setTimeout(resolve, ms);
    const onAbort = () => { clearTimeout(timer); resolve(); };
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

export async function runStoreAndSendLoop(
  db: SQLiteDatabase,
  serverUrl: string,
  authToken: string,
  signal: AbortSignal,
  onUpdate: (update: SyncUpdate) => void
): Promise<void> {
  while (!signal.aborted) {
    try {
      const pendingGravesList = await getPendingGraves(db);
      const pendingImagesList = await getPendingImages(db);

      onUpdate({ activity: 'idle', pendingGraves: pendingGravesList.length, pendingImages: pendingImagesList.length });

      if (pendingGravesList.length === 0 && pendingImagesList.length === 0) {
        onUpdate({ activity: 'idle', pendingGraves: 0, pendingImages: 0, sleepUntil: Date.now() + 15_000 });
        await abortableSleep(15_000, signal);
        continue;
      }

      // Sync graves first
      let lastGraveSyncTime = 0;
      if (pendingGravesList.length > 0) {
        onUpdate({ activity: 'syncing_graves', pendingGraves: pendingGravesList.length, pendingImages: pendingImagesList.length });
        await syncGraveBatch(db, serverUrl, authToken);
        lastGraveSyncTime = Date.now();
      }

      // Upload images one by one
      const freshImages = await getPendingImages(db);
      for (let i = 0; i < freshImages.length; i++) {
        if (signal.aborted) break;

        const freshGraves = await getPendingGraves(db);
        onUpdate({ activity: { uploading: i + 1, total: freshImages.length }, pendingGraves: freshGraves.length, pendingImages: freshImages.length - i });

        await uploadSingleImage(db, freshImages[i], serverUrl, authToken);

        // Re-sync graves every 60s to attach newly uploaded image server_ids
        if (Date.now() - lastGraveSyncTime > 60_000) {
          const pendingGravesNow = await getPendingGraves(db);
          if (pendingGravesNow.length > 0) {
            onUpdate({ activity: 'syncing_graves', pendingGraves: pendingGravesNow.length, pendingImages: freshImages.length - i - 1 });
            await syncGraveBatch(db, serverUrl, authToken);
            lastGraveSyncTime = Date.now();
          }
        }
      }

      // Final grave sync to attach any remaining image server_ids
      if (!signal.aborted) {
        const finalPending = await getPendingGraves(db);
        if (finalPending.length > 0) {
          onUpdate({ activity: 'syncing_graves', pendingGraves: finalPending.length, pendingImages: 0 });
          await syncGraveBatch(db, serverUrl, authToken);
        }
      }

      // No delay — loop immediately to check for new data
    } catch (err) {
      console.warn('Background sync error:', err);
      const g = await getPendingGraves(db).catch(() => []);
      const i = await getPendingImages(db).catch(() => []);
      onUpdate({ activity: 'error', pendingGraves: g.length, pendingImages: i.length });
    }
  }
}

export async function runStoreOnlyLoop(
  db: SQLiteDatabase,
  serverUrl: string,
  authToken: string,
  signal: AbortSignal,
  onUpdate: (update: SyncUpdate) => void
): Promise<void> {
  while (!signal.aborted) {
    try {
      const pendingGravesList = await getPendingGraves(db);
      const pendingImagesList = await getPendingImages(db);

      onUpdate({ activity: 'idle', pendingGraves: pendingGravesList.length, pendingImages: pendingImagesList.length });

      if (pendingGravesList.length > 0) {
        onUpdate({ activity: 'syncing_graves', pendingGraves: pendingGravesList.length, pendingImages: pendingImagesList.length });
        await syncGraveBatch(db, serverUrl, authToken);
        // No delay — loop immediately to check for more
      } else {
        onUpdate({ activity: 'idle', pendingGraves: 0, pendingImages: pendingImagesList.length, sleepUntil: Date.now() + 15_000 });
        await abortableSleep(15_000, signal);
      }
    } catch (err) {
      console.warn('Background sync (store-only) error:', err);
      const g = await getPendingGraves(db).catch(() => []);
      const i = await getPendingImages(db).catch(() => []);
      onUpdate({ activity: 'error', pendingGraves: g.length, pendingImages: i.length });
    }
  }
}
