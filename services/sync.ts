import type { SQLiteDatabase } from 'expo-sqlite';
import { generateUUID } from '@/utils/uuid';
import { getPendingGraves } from '@/db/graves';
import { getPersonsByGraveId } from '@/db/persons';
import { getPendingImages, markImageUploaded, getImagesByGraveId } from '@/db/images';
import { apiRequest, uploadFile } from './api';
import type { LocalGrave, LocalGravePerson, LocalGraveImage } from '@/db/types';

interface SyncOperation {
  action: 'create' | 'update' | 'delete';
  tempId?: string;
  id?: number;
  data?: {
    uid?: string;
    status: string;
    type: string;
    location: string | null;
    rotation: number;
    latitude: number | null;
    longitude: number | null;
    notes: string | null;
    persons: {
      name: string;
      birthDay: string;
      birthMonth: string;
      birthYear: string;
      deathDay: string;
      deathMonth: string;
      deathYear: string;
      notes: string;
    }[];
    images: { id: number }[];
  };
}

interface SyncResult {
  action: string;
  tempId?: string;
  id?: number;
  serverId?: number;
  status: string;
  message?: string;
}

interface SyncResponse {
  results: SyncResult[];
}

interface ServerPerson {
  id: number;
  name: string;
  birthDay: string;
  birthMonth: string;
  birthYear: string;
  deathDay: string;
  deathMonth: string;
  deathYear: string;
  notes: string;
  order: number;
}

interface ServerImageThumb {
  path: string;
  width: number;
  height: number;
}

interface ServerGraveImage {
  id: number;
  order: number;
  imageId: number;
  image: {
    id: number;
    source: string;
    thumbs: ServerImageThumb[];
  };
}

interface ServerGrave {
  id: number;
  uid: string;
  status: string;
  type: string;
  location: string | null;
  rotation: number;
  latitude: number | null;
  longitude: number | null;
  notes: string | null;
  createdAt: string;
  persons: ServerPerson[];
  images: ServerGraveImage[];
}

interface PaginatedResponse {
  data: ServerGrave[];
  total: number;
}

function buildImageUrl(serverUrl: string, img: ServerGraveImage): string {
  const path = img.image.thumbs?.[0]?.path ?? img.image.source;
  if (path.startsWith('http')) return path;
  return `${serverUrl}/uploads${path}`;
}

function buildFullImageUrl(serverUrl: string, img: ServerGraveImage): string {
  const thumbs = img.image.thumbs;
  const path = thumbs?.length ? thumbs[thumbs.length - 1].path : img.image.source;
  if (path.startsWith('http')) return path;
  return `${serverUrl}/uploads${path}`;
}

function buildGravePayload(
  grave: LocalGrave,
  persons: LocalGravePerson[],
  images: LocalGraveImage[]
) {
  return {
    status: grave.status,
    type: grave.type,
    location: grave.location || null,
    rotation: grave.rotation,
    latitude: grave.latitude || null,
    longitude: grave.longitude || null,
    notes: grave.notes || null,
    persons: persons.map((p) => ({
      name: p.name,
      birthDay: p.birth_day,
      birthMonth: p.birth_month,
      birthYear: p.birth_year,
      deathDay: p.death_day,
      deathMonth: p.death_month,
      deathYear: p.death_year,
      notes: p.notes,
    })),
    images: images
      .filter((img) => img.server_id != null)
      .map((img) => ({ id: img.server_id! })),
  };
}

export interface SyncProgress {
  phase: 'images' | 'graves' | 'done';
  imagesCurrent: number;
  imagesTotal: number;
  gravesTotal: number;
}

export async function uploadSingleImage(
  db: SQLiteDatabase,
  image: LocalGraveImage,
  serverUrl: string,
  authToken: string
): Promise<boolean> {
  try {
    const result = await uploadFile(serverUrl, image.file_uri, authToken);
    await markImageUploaded(db, image.local_id, result.id);
    return true;
  } catch (err) {
    console.warn('Image upload failed:', image.local_id, err);
    return false;
  }
}

export async function syncGraveBatch(
  db: SQLiteDatabase,
  serverUrl: string,
  authToken: string
): Promise<{ synced: number; failed: number }> {
  const pendingGraves = await getPendingGraves(db);
  const operations: SyncOperation[] = [];

  for (const grave of pendingGraves) {
    const persons = await getPersonsByGraveId(db, grave.local_id);
    const images = await getImagesByGraveId(db, grave.local_id);

    if (grave.sync_status === 'deleted' && grave.server_id) {
      operations.push({
        action: 'delete',
        id: grave.server_id,
      });
    } else if (grave.sync_status === 'pending') {
      operations.push({
        action: 'create',
        tempId: grave.local_id,
        data: { uid: grave.uid, ...buildGravePayload(grave, persons, images) },
      });
    } else if (grave.sync_status === 'modified' && grave.server_id) {
      operations.push({
        action: 'update',
        id: grave.server_id,
        data: buildGravePayload(grave, persons, images),
      });
    }
  }

  if (operations.length === 0) return { synced: 0, failed: 0 };

  const response = await apiRequest<SyncResponse>(serverUrl, '/api/cemetery/sync', {
    method: 'POST',
    token: authToken,
    body: { operations },
  });

  let synced = 0;
  let failed = 0;

  for (const result of response.results) {
    if (result.status !== 'ok') {
      console.warn('Sync operation failed:', result);
      failed++;
      continue;
    }

    synced++;

    if (result.action === 'create' && result.tempId && result.serverId) {
      await db.runAsync(
        `UPDATE local_graves SET server_id = ?, sync_status = 'synced' WHERE local_id = ?`,
        [result.serverId, result.tempId]
      );
    } else if (result.action === 'update' && result.id) {
      const grave = pendingGraves.find((g) => g.server_id === result.id);
      if (grave) {
        await db.runAsync(
          `UPDATE local_graves SET sync_status = 'synced' WHERE local_id = ?`,
          [grave.local_id]
        );
      }
    } else if (result.action === 'delete' && result.id) {
      const grave = pendingGraves.find((g) => g.server_id === result.id);
      if (grave) {
        await db.runAsync('DELETE FROM local_graves WHERE local_id = ?', [grave.local_id]);
      }
    }
  }

  return { synced, failed };
}

export async function syncAll(
  db: SQLiteDatabase,
  serverUrl: string,
  authToken: string,
  onProgress?: (progress: SyncProgress) => void
): Promise<void> {
  // 1. Upload pending images
  const pendingImages = await getPendingImages(db);
  const pendingGravesPrecount = (await getPendingGraves(db)).length;

  for (let i = 0; i < pendingImages.length; i++) {
    onProgress?.({ phase: 'images', imagesCurrent: i + 1, imagesTotal: pendingImages.length, gravesTotal: pendingGravesPrecount });
    await uploadSingleImage(db, pendingImages[i], serverUrl, authToken);
  }

  // 2. Sync graves batch
  onProgress?.({ phase: 'graves', imagesCurrent: pendingImages.length, imagesTotal: pendingImages.length, gravesTotal: pendingGravesPrecount });
  await syncGraveBatch(db, serverUrl, authToken);

  onProgress?.({ phase: 'done', imagesCurrent: pendingImages.length, imagesTotal: pendingImages.length, gravesTotal: 0 });
}

const PULL_PAGE_SIZE = 50;

export async function pullFromServer(
  db: SQLiteDatabase,
  serverUrl: string,
  authToken: string,
  onProgress?: (fetched: number, total: number) => void
): Promise<{ created: number; updated: number; skipped: number }> {
  let page = 1;
  let fetched = 0;
  let total = 0;
  let created = 0;
  let updated = 0;
  let skipped = 0;

  // Fetch all pages
  const allGraves: ServerGrave[] = [];

  do {
    const response = await apiRequest<PaginatedResponse>(
      serverUrl,
      `/api/cemetery/graves?page=${page}&size=${PULL_PAGE_SIZE}&orderBy=id&orderDirection=asc`,
      { token: authToken }
    );

    total = response.total;
    allGraves.push(...response.data);
    fetched += response.data.length;
    onProgress?.(fetched, total);
    page++;
  } while (fetched < total);

  // Upsert each grave into local DB
  for (const serverGrave of allGraves) {
    const existing = await db.getFirstAsync<LocalGrave>(
      'SELECT * FROM local_graves WHERE server_id = ?',
      [serverGrave.id]
    );

    if (existing) {
      // Skip graves with local pending changes
      if (existing.sync_status !== 'synced') {
        skipped++;
        continue;
      }

      // Update existing synced grave
      await db.runAsync(
        `UPDATE local_graves SET uid = ?, location = ?, latitude = ?, longitude = ?, rotation = ?,
         type = ?, status = ?, notes = ?, created_at = datetime(?), updated_at = datetime('now')
         WHERE local_id = ?`,
        [
          serverGrave.uid ?? '',
          serverGrave.location ?? '',
          serverGrave.latitude ?? 0,
          serverGrave.longitude ?? 0,
          serverGrave.rotation,
          serverGrave.type,
          serverGrave.status,
          serverGrave.notes ?? '',
          serverGrave.createdAt,
          existing.local_id,
        ]
      );

      // Replace persons
      await db.runAsync('DELETE FROM local_grave_persons WHERE grave_local_id = ?', [existing.local_id]);
      for (const person of serverGrave.persons) {
        await db.runAsync(
          `INSERT INTO local_grave_persons (local_id, grave_local_id, server_id, name, birth_day, birth_month, birth_year, death_day, death_month, death_year, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [generateUUID(), existing.local_id, person.id, person.name, person.birthDay, person.birthMonth, person.birthYear, person.deathDay, person.deathMonth, person.deathYear, person.notes]
        );
      }

      // Replace images (keep store_only images that are local-only)
      await db.runAsync(
        `DELETE FROM local_grave_images WHERE grave_local_id = ? AND upload_status != 'store_only'`,
        [existing.local_id]
      );
      for (const img of serverGrave.images) {
        const imageUrl = buildImageUrl(serverUrl, img);
        const fullUrl = buildFullImageUrl(serverUrl, img);
        await db.runAsync(
          `INSERT INTO local_grave_images (local_id, grave_local_id, server_id, file_uri, full_uri, upload_status)
           VALUES (?, ?, ?, ?, ?, 'uploaded')`,
          [generateUUID(), existing.local_id, img.image.id, imageUrl, fullUrl]
        );
      }

      updated++;
    } else {
      // Insert new grave
      const localId = generateUUID();

      await db.runAsync(
        `INSERT INTO local_graves (local_id, server_id, uid, location, latitude, longitude, rotation, type, status, notes, sync_status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', datetime(?))`,
        [
          localId,
          serverGrave.id,
          serverGrave.uid ?? '',
          serverGrave.location ?? '',
          serverGrave.latitude ?? 0,
          serverGrave.longitude ?? 0,
          serverGrave.rotation,
          serverGrave.type,
          serverGrave.status,
          serverGrave.notes ?? '',
          serverGrave.createdAt,
        ]
      );

      for (const person of serverGrave.persons) {
        await db.runAsync(
          `INSERT INTO local_grave_persons (local_id, grave_local_id, server_id, name, birth_day, birth_month, birth_year, death_day, death_month, death_year, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [generateUUID(), localId, person.id, person.name, person.birthDay, person.birthMonth, person.birthYear, person.deathDay, person.deathMonth, person.deathYear, person.notes]
        );
      }

      for (const img of serverGrave.images) {
        const imageUrl = buildImageUrl(serverUrl, img);
        const fullUrl = buildFullImageUrl(serverUrl, img);
        await db.runAsync(
          `INSERT INTO local_grave_images (local_id, grave_local_id, server_id, file_uri, full_uri, upload_status)
           VALUES (?, ?, ?, ?, ?, 'uploaded')`,
          [generateUUID(), localId, img.image.id, imageUrl, fullUrl]
        );
      }

      created++;
    }
  }

  return { created, updated, skipped };
}
