import type { SQLiteDatabase } from 'expo-sqlite';
import type { LocalGravePerson } from './types';

export async function getPersonsByGraveId(db: SQLiteDatabase, graveLocalId: string): Promise<LocalGravePerson[]> {
  return db.getAllAsync<LocalGravePerson>(
    `SELECT * FROM local_grave_persons WHERE grave_local_id = ? ORDER BY created_at`,
    [graveLocalId]
  );
}

export async function insertPerson(db: SQLiteDatabase, person: Omit<LocalGravePerson, 'created_at'>): Promise<void> {
  await db.runAsync(
    `INSERT INTO local_grave_persons (local_id, grave_local_id, server_id, name, birth_day, birth_month, birth_year, death_day, death_month, death_year, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      person.local_id,
      person.grave_local_id,
      person.server_id ?? null,
      person.name,
      person.birth_day,
      person.birth_month,
      person.birth_year,
      person.death_day,
      person.death_month,
      person.death_year,
      person.notes,
    ]
  );
}

export async function deletePersonsByGraveId(db: SQLiteDatabase, graveLocalId: string): Promise<void> {
  await db.runAsync(
    `DELETE FROM local_grave_persons WHERE grave_local_id = ?`,
    [graveLocalId]
  );
}
