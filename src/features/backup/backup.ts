import Constants from 'expo-constants';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { defaultDatabaseDirectory, openDatabaseSync } from 'expo-sqlite';
import JSZip from 'jszip';

import { closeDb, DB_NAME, getDb } from '../../db/database';
import { LATEST_SCHEMA_VERSION } from '../../db/migrations';
import { ensureEvidenceDir, EVIDENCE_DIR_NAME, evidenceDirUri } from '../evidence/files';
import { reconcileReminders } from '../reminders/scheduler';
import { parseBackupManifest, type BackupManifest } from './manifest';

/**
 * Local backup: a zip containing a VACUUM INTO snapshot of the SQLite db,
 * the evidence/ directory, and manifest.json (app + schema version,
 * timestamp, counts). Restore validates the manifest and runs SQLite
 * integrity_check on the extracted database before touching live data.
 */

export type { BackupManifest } from './manifest';

export interface BackupPreview {
  manifest: BackupManifest;
  evidenceCount: number;
}

function dbDirUri(): string {
  return `${String(defaultDatabaseDirectory).replace(/\/?$/, '/')}`;
}

function dbFileUri(): string {
  return dbDirUri() + DB_NAME;
}

async function readDirFiles(uri: string): Promise<string[]> {
  const info = await FileSystem.getInfoAsync(uri);
  if (!info.exists) return [];
  return FileSystem.readDirectoryAsync(uri);
}

/** Create the backup zip in cache and return its URI. Throws on failure. */
export async function createBackup(): Promise<string> {
  const db = getDb();
  const integrity = db.getFirstSync<{ integrity_check: string }>('PRAGMA integrity_check');
  if (integrity?.integrity_check !== 'ok') {
    throw new Error('Database failed integrity check — backup aborted.');
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const workDir = `${FileSystem.cacheDirectory}ProTrack-backup-${stamp}/`;
  const zipName = `ProTrack-backup-${stamp}.zip`;
  const zipUri = `${FileSystem.cacheDirectory}${zipName}`;

  try {
    await FileSystem.makeDirectoryAsync(workDir, { intermediates: true });
    const snapPath = `${workDir}${DB_NAME}`;
    db.execSync(`VACUUM INTO '${snapPath}'`);

    const zip = new JSZip();
    const dbB64 = await FileSystem.readAsStringAsync(snapPath, { encoding: FileSystem.EncodingType.Base64 });
    zip.file(DB_NAME, dbB64, { base64: true });

    await ensureEvidenceDir();
    const evidenceFiles = await readDirFiles(evidenceDirUri());
    for (const name of evidenceFiles) {
      const b64 = await FileSystem.readAsStringAsync(`${evidenceDirUri()}${name}`, {
        encoding: FileSystem.EncodingType.Base64,
      });
      zip.file(`${EVIDENCE_DIR_NAME}/${name}`, b64, { base64: true });
    }

    const manifest: BackupManifest = {
      app: 'ProTrack',
      appVersion: Constants.expoConfig?.version ?? '1.0.0',
      schemaVersion: LATEST_SCHEMA_VERSION,
      createdAt: new Date().toISOString(),
      evidenceCount: evidenceFiles.length,
    };
    zip.file('manifest.json', JSON.stringify(manifest, null, 2));

    const outB64 = await zip.generateAsync({ type: 'base64', compression: 'DEFLATE' });
    await FileSystem.writeAsStringAsync(zipUri, outB64, { encoding: FileSystem.EncodingType.Base64 });
    return zipUri;
  } finally {
    await FileSystem.deleteAsync(workDir, { idempotent: true }).catch(() => {});
  }
}

async function loadZip(zipUri: string): Promise<JSZip> {
  const b64 = await FileSystem.readAsStringAsync(zipUri, { encoding: FileSystem.EncodingType.Base64 });
  return JSZip.loadAsync(b64, { base64: true });
}

/** Validate a picked backup zip. Returns preview info or throws a user-safe message. */
export async function inspectBackup(zipUri: string): Promise<BackupPreview> {
  const zip = await loadZip(zipUri);
  const manifestFile = zip.file('manifest.json');
  const dbFile = zip.file(DB_NAME);
  if (!manifestFile || !dbFile) throw new Error('Not a ProTrack backup.');

  const manifest = parseBackupManifest(await manifestFile.async('string'));

  // Open the extracted db copy and run SQLite's own integrity check.
  const checkDir = `${dbDirUri()}__restore_check/`;
  const checkName = 'check.db';
  try {
    await FileSystem.makeDirectoryAsync(checkDir, { intermediates: true });
    const dbB64 = await dbFile.async('base64');
    await FileSystem.writeAsStringAsync(`${checkDir}${checkName}`, dbB64, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const check = openDatabaseSync(checkName, {}, checkDir);
    try {
      const integrity = check.getFirstSync<{ integrity_check: string }>('PRAGMA integrity_check');
      if (integrity?.integrity_check !== 'ok') throw new Error('Backup database failed integrity check.');
      const hasProjects = check.getFirstSync<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='projects'",
      );
      if (!hasProjects) throw new Error('Backup database is missing expected tables.');
    } finally {
      check.closeSync();
    }
  } finally {
    await FileSystem.deleteAsync(checkDir, { idempotent: true }).catch(() => {});
  }

  const evidenceCount = Object.keys(zip.files).filter((n) => n.startsWith(`${EVIDENCE_DIR_NAME}/`) && !zip.files[n].dir).length;
  return { manifest, evidenceCount };
}

/**
 * Replace local data with the backup. Caller must have run inspectBackup
 * and collected user confirmation. Reopens the DB and reschedules reminders.
 */
export async function restoreBackup(zipUri: string): Promise<void> {
  const preview = await inspectBackup(zipUri);
  void preview;
  const zip = await loadZip(zipUri);
  const dbFile = zip.file(DB_NAME)!;

  closeDb();

  // Remove current database files (db + WAL sidecars) and evidence contents.
  for (const suffix of ['', '-wal', '-shm']) {
    await FileSystem.deleteAsync(`${dbFileUri()}${suffix}`, { idempotent: true }).catch(() => {});
  }
  const existing = await readDirFiles(evidenceDirUri());
  for (const name of existing) {
    await FileSystem.deleteAsync(`${evidenceDirUri()}${name}`, { idempotent: true }).catch(() => {});
  }
  await ensureEvidenceDir();

  // Write the snapshot database.
  const dbB64 = await dbFile.async('base64');
  await FileSystem.writeAsStringAsync(dbFileUri(), dbB64, { encoding: FileSystem.EncodingType.Base64 });

  // Extract evidence files.
  for (const [name, file] of Object.entries(zip.files)) {
    if (!name.startsWith(`${EVIDENCE_DIR_NAME}/`) || file.dir) continue;
    const safe = name.slice(EVIDENCE_DIR_NAME.length + 1);
    if (!safe || safe.includes('..')) continue;
    const b64 = await file.async('base64');
    await FileSystem.writeAsStringAsync(`${evidenceDirUri()}${safe}`, b64, {
      encoding: FileSystem.EncodingType.Base64,
    });
  }

  // Reopen — migrations run if the backup schema is older.
  getDb();
  void reconcileReminders();
}

/** Pick a backup file from the device. Returns its URI or null when cancelled. */
export async function pickBackupFile(): Promise<string | null> {
  const res = await DocumentPicker.getDocumentAsync({
    copyToCacheDirectory: true,
    type: ['application/zip', 'application/octet-stream', '*/*'],
  });
  if (res.canceled || !res.assets?.length) return null;
  return res.assets[0].uri;
}
