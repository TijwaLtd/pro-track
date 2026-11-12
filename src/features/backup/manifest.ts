import { LATEST_SCHEMA_VERSION } from '../../db/migrations';

/**
 * Pure manifest validation for backups — kept free of filesystem/SQLite
 * imports so it can be unit-tested. inspectBackup() in backup.ts uses
 * these after extracting manifest.json from the zip.
 */

export interface BackupManifest {
  app: 'ProTrack';
  appVersion: string;
  schemaVersion: number;
  createdAt: string;
  evidenceCount: number;
}

export class BackupValidationError extends Error {}

/** Parse and validate a raw manifest.json string. Throws BackupValidationError. */
export function parseBackupManifest(raw: string): BackupManifest {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new BackupValidationError('Backup manifest is unreadable.');
  }
  if (typeof parsed !== 'object' || parsed === null) {
    throw new BackupValidationError('Backup manifest is unreadable.');
  }
  const m = parsed as Record<string, unknown>;
  if (m.app !== 'ProTrack') throw new BackupValidationError('Not a ProTrack backup.');
  if (typeof m.schemaVersion !== 'number' || !Number.isInteger(m.schemaVersion) || m.schemaVersion < 1) {
    throw new BackupValidationError('Backup manifest is unreadable.');
  }
  if (m.schemaVersion > LATEST_SCHEMA_VERSION) {
    throw new BackupValidationError('This backup is from a newer version of the app.');
  }
  return {
    app: 'ProTrack',
    appVersion: typeof m.appVersion === 'string' ? m.appVersion : 'unknown',
    schemaVersion: m.schemaVersion,
    createdAt: typeof m.createdAt === 'string' ? m.createdAt : '',
    evidenceCount: typeof m.evidenceCount === 'number' ? m.evidenceCount : 0,
  };
}
