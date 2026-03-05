import type { SQLiteDatabase, SQLiteBindValue } from 'expo-sqlite';
import { generateUUID } from '@/utils/uuid';
import type { LocalGrave, GraveListItem, GraveWithRelations } from './types';

export async function getAllGraves(db: SQLiteDatabase): Promise<GraveListItem[]> {
  return db.getAllAsync<GraveListItem>(
    `SELECT g.*,
       COALESCE(GROUP_CONCAT(CASE WHEN p.name != '' THEN p.name END, ', '), '') as persons_summary,
       (SELECT i.file_uri FROM local_grave_images i WHERE i.grave_local_id = g.local_id ORDER BY i.created_at LIMIT 1) as first_photo_uri,
       (SELECT COUNT(*) FROM local_grave_images i WHERE i.grave_local_id = g.local_id) as photo_count
     FROM local_graves g
     LEFT JOIN local_grave_persons p ON p.grave_local_id = g.local_id
     WHERE g.sync_status != 'deleted'
     GROUP BY g.local_id
     ORDER BY g.created_at DESC`
  );
}

export async function getGraveById(db: SQLiteDatabase, localId: string): Promise<GraveWithRelations | null> {
  const grave = await db.getFirstAsync<LocalGrave>(
    `SELECT * FROM local_graves WHERE local_id = ?`,
    [localId]
  );
  if (!grave) return null;

  const persons = await db.getAllAsync(
    `SELECT * FROM local_grave_persons WHERE grave_local_id = ? ORDER BY created_at`,
    [localId]
  );
  const images = await db.getAllAsync(
    `SELECT * FROM local_grave_images WHERE grave_local_id = ? ORDER BY created_at`,
    [localId]
  );

  return { ...grave, persons, images } as GraveWithRelations;
}

export async function insertGrave(
  db: SQLiteDatabase,
  grave: Omit<LocalGrave, 'created_at' | 'updated_at' | 'sync_status' | 'server_id' | 'uid'> & { uid?: string }
): Promise<void> {
  const uid = grave.uid ?? generateUUID();
  await db.runAsync(
    `INSERT INTO local_graves (local_id, uid, location, latitude, longitude, rotation, type, status, notes, sync_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
    [
      grave.local_id,
      uid,
      grave.location,
      grave.latitude,
      grave.longitude,
      grave.rotation,
      grave.type,
      grave.status,
      grave.notes,
    ]
  );
}

export async function updateGrave(
  db: SQLiteDatabase,
  localId: string,
  data: Partial<Pick<LocalGrave, 'location' | 'latitude' | 'longitude' | 'rotation' | 'type' | 'status' | 'notes'>>
): Promise<void> {
  const fields: string[] = [];
  const values: SQLiteBindValue[] = [];

  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      fields.push(`${key} = ?`);
      values.push(value as SQLiteBindValue);
    }
  }

  if (fields.length === 0) return;

  fields.push(`updated_at = datetime('now')`);
  fields.push(`sync_status = CASE WHEN sync_status = 'synced' THEN 'modified' ELSE sync_status END`);
  values.push(localId);

  await db.runAsync(
    `UPDATE local_graves SET ${fields.join(', ')} WHERE local_id = ?`,
    values
  );
}

export async function deleteGrave(db: SQLiteDatabase, localId: string): Promise<void> {
  const grave = await db.getFirstAsync<LocalGrave>(
    `SELECT * FROM local_graves WHERE local_id = ?`,
    [localId]
  );

  if (!grave) return;

  if (grave.server_id) {
    await db.runAsync(
      `UPDATE local_graves SET sync_status = 'deleted', updated_at = datetime('now') WHERE local_id = ?`,
      [localId]
    );
  } else {
    await db.runAsync(`DELETE FROM local_graves WHERE local_id = ?`, [localId]);
  }
}

export async function searchGraves(db: SQLiteDatabase, query: string): Promise<GraveListItem[]> {
  const like = `%${query}%`;
  return db.getAllAsync<GraveListItem>(
    `SELECT g.*,
       COALESCE(GROUP_CONCAT(CASE WHEN p.name != '' THEN p.name END, ', '), '') as persons_summary,
       (SELECT i.file_uri FROM local_grave_images i WHERE i.grave_local_id = g.local_id ORDER BY i.created_at LIMIT 1) as first_photo_uri,
       (SELECT COUNT(*) FROM local_grave_images i WHERE i.grave_local_id = g.local_id) as photo_count
     FROM local_graves g
     LEFT JOIN local_grave_persons p ON p.grave_local_id = g.local_id
     WHERE g.sync_status != 'deleted'
       AND (g.notes LIKE ? OR p.name LIKE ?)
     GROUP BY g.local_id
     ORDER BY g.created_at DESC`,
    [like, like]
  );
}

export async function getPendingGraves(db: SQLiteDatabase): Promise<LocalGrave[]> {
  return db.getAllAsync<LocalGrave>(
    `SELECT * FROM local_graves WHERE sync_status IN ('pending', 'modified', 'deleted')`
  );
}
