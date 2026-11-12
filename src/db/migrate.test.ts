import { describe, expect, it } from '@jest/globals';
import { DatabaseSync } from 'node:sqlite';
import { assertSchemaCurrent, getSchemaVersion, runMigrations, type MigrationDb } from './migrate';
import { LATEST_SCHEMA_VERSION } from './migrations';

function sqliteMigrationDb(): { db: DatabaseSync; mig: MigrationDb } {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  return {
    db,
    mig: {
      exec: (sql) => db.exec(sql),
      get: <T,>(sql: string) => (db.prepare(sql).get() as T) ?? null,
    },
  };
}

describe('migrations', () => {
  it('creates a fresh database at the latest schema version', () => {
    const { db, mig } = sqliteMigrationDb();
    const result = runMigrations(mig);
    expect(result.applied).toEqual([1]);
    expect(getSchemaVersion(mig)).toBe(LATEST_SCHEMA_VERSION);
    expect(() => assertSchemaCurrent(mig)).not.toThrow();

    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all()
      .map((r: unknown) => (r as { name: string }).name);
    expect(tables).toEqual(
      expect.arrayContaining([
        'projects',
        'project_items',
        'payments',
        'payment_evidence',
        'activity_logs',
        'reminders',
        'settings',
      ]),
    );
    db.close();
  });

  it('is idempotent — running twice applies nothing', () => {
    const { db, mig } = sqliteMigrationDb();
    runMigrations(mig);
    const second = runMigrations(mig);
    expect(second.applied).toEqual([]);
    db.close();
  });

  it('enforces foreign keys', () => {
    const { db, mig } = sqliteMigrationDb();
    runMigrations(mig);
    expect(() =>
      db.prepare("INSERT INTO project_items (id, project_id, title, currency_code, avatar_key, created_at, updated_at) VALUES ('i1','missing','x','KES','lion','t','t')").run(),
    ).toThrow();
    db.close();
  });
});
