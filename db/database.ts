import type { SQLiteDatabase } from 'expo-sqlite';

const CURRENT_VERSION = 5;

export async function migrateDb(db: SQLiteDatabase) {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
  `);

  const result = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const version = result?.user_version ?? 0;

  if (version < 3) {
    // Drop old tables (v1 had section/row/number, v2 had birth_date/death_date)
    await db.execAsync(`
      DROP TABLE IF EXISTS local_grave_images;
      DROP TABLE IF EXISTS local_grave_persons;
      DROP TABLE IF EXISTS local_graves;
    `);
  }

  if (version >= 3 && version < 4) {
    await db.execAsync(`
      ALTER TABLE local_graves ADD COLUMN uid TEXT NOT NULL DEFAULT '';
    `);
  }

  if (version >= 4 && version < 5) {
    await db.execAsync(`
      ALTER TABLE local_grave_images ADD COLUMN full_uri TEXT NOT NULL DEFAULT '';
    `);
  }

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS local_graves (
      local_id TEXT PRIMARY KEY NOT NULL,
      server_id INTEGER,
      uid TEXT NOT NULL DEFAULT '',
      location TEXT NOT NULL DEFAULT '',
      latitude REAL NOT NULL DEFAULT 0,
      longitude REAL NOT NULL DEFAULT 0,
      rotation REAL NOT NULL DEFAULT 0,
      type TEXT NOT NULL DEFAULT 'REGULAR',
      status TEXT NOT NULL DEFAULT 'VISIBLE',
      notes TEXT NOT NULL DEFAULT '',
      sync_status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS local_grave_persons (
      local_id TEXT PRIMARY KEY NOT NULL,
      grave_local_id TEXT NOT NULL,
      server_id INTEGER,
      name TEXT NOT NULL DEFAULT '',
      birth_day TEXT NOT NULL DEFAULT '',
      birth_month TEXT NOT NULL DEFAULT '',
      birth_year TEXT NOT NULL DEFAULT '',
      death_day TEXT NOT NULL DEFAULT '',
      death_month TEXT NOT NULL DEFAULT '',
      death_year TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (grave_local_id) REFERENCES local_graves(local_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS local_grave_images (
      local_id TEXT PRIMARY KEY NOT NULL,
      grave_local_id TEXT NOT NULL,
      server_id INTEGER,
      file_uri TEXT NOT NULL DEFAULT '',
      full_uri TEXT NOT NULL DEFAULT '',
      upload_status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (grave_local_id) REFERENCES local_graves(local_id) ON DELETE CASCADE
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_graves_server_id ON local_graves(server_id) WHERE server_id IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_graves_sync_status ON local_graves(sync_status);
    CREATE INDEX IF NOT EXISTS idx_persons_grave_id ON local_grave_persons(grave_local_id);
    CREATE INDEX IF NOT EXISTS idx_images_grave_id ON local_grave_images(grave_local_id);
    CREATE INDEX IF NOT EXISTS idx_images_upload_status ON local_grave_images(upload_status);

    PRAGMA user_version = ${CURRENT_VERSION};
  `);
}
