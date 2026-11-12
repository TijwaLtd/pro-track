/**
 * Backup provider abstraction. v1 ships only the local provider
 * (zip export/share + document-picker restore). A future Google Drive
 * provider implements the same interface — one-way backup/restore only,
 * no sync or conflict resolution.
 */
export interface BackupProvider {
  id: 'local' | 'google-drive';
  displayName: string;
  /** Produce and deliver a backup (share sheet for local, upload for Drive). */
  exportBackup(): Promise<void>;
  /** Pick/locate a backup, validate it, and restore after user confirmation. */
  restoreBackup(): Promise<void>;
}
