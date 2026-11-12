import { describe, expect, it } from '@jest/globals';

import { LATEST_SCHEMA_VERSION } from '../../db/migrations';
import { parseBackupManifest } from './manifest';

const valid = {
  app: 'ProTrack',
  appVersion: '1.0.0',
  schemaVersion: LATEST_SCHEMA_VERSION,
  createdAt: '2025-01-01T00:00:00.000Z',
  evidenceCount: 3,
};

describe('parseBackupManifest', () => {
  it('accepts a valid manifest', () => {
    const m = parseBackupManifest(JSON.stringify(valid));
    expect(m.app).toBe('ProTrack');
    expect(m.schemaVersion).toBe(LATEST_SCHEMA_VERSION);
    expect(m.evidenceCount).toBe(3);
  });

  it('accepts older schema versions (migrations run on restore)', () => {
    const m = parseBackupManifest(JSON.stringify({ ...valid, schemaVersion: 1 }));
    expect(m.schemaVersion).toBe(1);
  });

  it('rejects malformed JSON', () => {
    expect(() => parseBackupManifest('{nope')).toThrow('unreadable');
  });

  it('rejects non-object manifests', () => {
    expect(() => parseBackupManifest('42')).toThrow('unreadable');
    expect(() => parseBackupManifest('null')).toThrow('unreadable');
  });

  it('rejects backups from other apps', () => {
    expect(() => parseBackupManifest(JSON.stringify({ ...valid, app: 'other' }))).toThrow('Not a ProTrack backup');
  });

  it('rejects backups from a newer app version', () => {
    expect(() =>
      parseBackupManifest(JSON.stringify({ ...valid, schemaVersion: LATEST_SCHEMA_VERSION + 1 })),
    ).toThrow('newer version');
  });

  it('rejects missing/invalid schemaVersion', () => {
    const { schemaVersion: _omit, ...noVersion } = valid;
    expect(() => parseBackupManifest(JSON.stringify(noVersion))).toThrow('unreadable');
    expect(() => parseBackupManifest(JSON.stringify({ ...valid, schemaVersion: 'x' }))).toThrow('unreadable');
    expect(() => parseBackupManifest(JSON.stringify({ ...valid, schemaVersion: 0 }))).toThrow('unreadable');
  });

  it('defaults optional fields when absent', () => {
    const m = parseBackupManifest(JSON.stringify({ app: 'ProTrack', schemaVersion: 1 }));
    expect(m.appVersion).toBe('unknown');
    expect(m.evidenceCount).toBe(0);
  });
});
