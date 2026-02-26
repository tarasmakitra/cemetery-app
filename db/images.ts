import type { SQLiteDatabase } from 'expo-sqlite';
import type { LocalGraveImage } from './types';

export async function getImagesByGraveId(db: SQLiteDatabase, graveLocalId: string): Promise<LocalGraveImage[]> {
  return db.getAllAsync<LocalGraveImage>(
    `SELECT * FROM local_grave_images WHERE grave_local_id = ? ORDER BY created_at`,
    [graveLocalId]
  );
}

export async function insertImage(db: SQLiteDatabase, image: Omit<LocalGraveImage, 'created_at'>): Promise<void> {
  await db.runAsync(
    `INSERT INTO local_grave_images (local_id, grave_local_id, server_id, file_uri, full_uri, upload_status)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      image.local_id,
      image.grave_local_id,
      image.server_id ?? null,
      image.file_uri,
      image.full_uri,
      image.upload_status,
    ]
  );

  // Mark the grave as modified so it gets re-synced with the new image
  await db.runAsync(
    `UPDATE local_graves SET sync_status = 'modified', updated_at = datetime('now')
     WHERE local_id = ? AND sync_status = 'synced'`,
    [image.grave_local_id]
  );
}

export async function deleteImage(db: SQLiteDatabase, localId: string): Promise<void> {
  const image = await db.getFirstAsync<LocalGraveImage>(
    `SELECT * FROM local_grave_images WHERE local_id = ?`,
    [localId]
  );
  await db.runAsync(`DELETE FROM local_grave_images WHERE local_id = ?`, [localId]);

  // Mark the grave as modified so the image removal gets synced
  if (image) {
    await db.runAsync(
      `UPDATE local_graves SET sync_status = 'modified', updated_at = datetime('now')
       WHERE local_id = ? AND sync_status = 'synced'`,
      [image.grave_local_id]
    );
  }
}

export async function getPendingImages(db: SQLiteDatabase): Promise<LocalGraveImage[]> {
  return db.getAllAsync<LocalGraveImage>(
    `SELECT * FROM local_grave_images WHERE upload_status = 'pending'`
  );
}

export async function markImageUploaded(db: SQLiteDatabase, localId: string, serverId: number): Promise<void> {
  await db.runAsync(
    `UPDATE local_grave_images SET upload_status = 'uploaded', server_id = ? WHERE local_id = ?`,
    [serverId, localId]
  );
}
