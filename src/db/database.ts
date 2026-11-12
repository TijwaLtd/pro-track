import { openDatabaseSync, SQLiteDatabase } from 'expo-sqlite';
import { assertSchemaCurrent, getSchemaVersion, MigrationDb, runMigrations } from './migrate';
import { LATEST_SCHEMA_VERSION } from './migrations';

export const DB_NAME = 'protrack.db';

let db: SQLiteDatabase | null = null;

function asMigrationDb(database: SQLiteDatabase): MigrationDb {
  return {
    exec: (sql) => database.execSync(sql),
    get: <T,>(sql: string) => database.getFirstSync<T>(sql) ?? null,
  };
}

/** Open (or create) the database, enable FK enforcement, run migrations, verify integrity. */
export function getDb(): SQLiteDatabase {
  if (db) return db;

  const database = openDatabaseSync(DB_NAME);
  database.execSync('PRAGMA foreign_keys = ON');
  database.execSync('PRAGMA journal_mode = WAL');

  const migDb = asMigrationDb(database);
  runMigrations(migDb);
  assertSchemaCurrent(migDb);

  const integrity = database.getFirstSync<{ integrity_check: string }>('PRAGMA integrity_check');
  if (integrity?.integrity_check !== 'ok') {
    throw new Error(`SQLite integrity_check failed: ${integrity?.integrity_check}`);
  }

  const fk = database.getFirstSync<{ foreign_keys: number }>('PRAGMA foreign_keys');
  if (fk?.foreign_keys !== 1) {
    throw new Error('SQLite foreign_keys pragma is not ON');
  }

  db = database;
  return db;
}

/** Close the cached connection (used before restoring a backup). */
export function closeDb(): void {
  db?.closeSync();
  db = null;
}

export function getSchemaVersionSafe(): number {
  try {
    return getSchemaVersion(asMigrationDb(getDb()));
  } catch {
    return 0;
  }
}

export { LATEST_SCHEMA_VERSION };
