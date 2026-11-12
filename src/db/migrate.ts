import { migrations, LATEST_SCHEMA_VERSION } from './migrations';

/** Minimal SQL surface needed to run migrations — implemented by expo-sqlite and by tests. */
export interface MigrationDb {
  exec(sql: string): void;
  get<T>(sql: string): T | null;
}

export interface MigrationResult {
  fromVersion: number;
  toVersion: number;
  applied: number[];
}

export function getSchemaVersion(db: MigrationDb): number {
  const row = db.get<{ user_version: number }>('PRAGMA user_version');
  return row?.user_version ?? 0;
}

export function runMigrations(db: MigrationDb): MigrationResult {
  const fromVersion = getSchemaVersion(db);
  const applied: number[] = [];

  for (const m of migrations) {
    if (m.version <= fromVersion) continue;
    db.exec('BEGIN');
    try {
      db.exec(m.sql);
      db.exec(`PRAGMA user_version = ${m.version}`);
      db.exec('COMMIT');
      applied.push(m.version);
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  }

  return { fromVersion, toVersion: getSchemaVersion(db), applied };
}

export function assertSchemaCurrent(db: MigrationDb): void {
  const v = getSchemaVersion(db);
  if (v !== LATEST_SCHEMA_VERSION) {
    throw new Error(`Schema version ${v} != latest ${LATEST_SCHEMA_VERSION}`);
  }
}
