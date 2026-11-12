import * as FileSystem from 'expo-file-system/legacy';

import type { EvidenceType } from '../../db/types';

/**
 * Evidence files are copied into app-private storage and referenced by
 * relative path in SQLite (DATABASE.md). Never store absolute/cache URIs.
 */

export const EVIDENCE_DIR_NAME = 'evidence';

export function evidenceDirUri(): string {
  return `${FileSystem.documentDirectory}${EVIDENCE_DIR_NAME}/`;
}

export async function ensureEvidenceDir(): Promise<void> {
  await FileSystem.makeDirectoryAsync(evidenceDirUri(), { intermediates: true }).catch(() => {});
}

export interface PickedFile {
  uri: string;
  fileName: string | null;
  mimeType: string | null;
  size: number | null;
  kind: 'image' | 'document';
}

export interface StoredEvidence {
  evidence_type: EvidenceType;
  original_filename: string | null;
  relative_path: string;
  mime_type: string | null;
  byte_size: number | null;
  checksum_sha256: string | null;
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^\w.\- ]+/g, '_').slice(-80) || 'file';
}

function evidenceTypeFor(picked: PickedFile): EvidenceType {
  if (picked.kind === 'image') return 'image';
  const mime = picked.mimeType ?? '';
  if (mime === 'application/pdf') return 'pdf';
  return 'document';
}

/**
 * Copy a picked file (content:// or file://) into the evidence directory.
 * Returns metadata ready for payment_evidence rows, or null on failure.
 */
export async function importEvidenceFile(picked: PickedFile): Promise<StoredEvidence | null> {
  try {
    await ensureEvidenceDir();
    const safeName = sanitizeFileName(picked.fileName ?? picked.uri.split('/').pop() ?? 'file');
    const destName = `${Date.now()}-${Math.floor(Math.random() * 1e6)}-${safeName}`;
    const destUri = evidenceDirUri() + destName;
    await FileSystem.copyAsync({ from: picked.uri, to: destUri });
    const info = await FileSystem.getInfoAsync(destUri);
    const size = picked.size ?? (info.exists ? info.size ?? null : null);
    return {
      evidence_type: evidenceTypeFor(picked),
      original_filename: picked.fileName ?? safeName,
      relative_path: `${EVIDENCE_DIR_NAME}/${destName}`,
      mime_type: picked.mimeType,
      byte_size: size,
      checksum_sha256: null,
    };
  } catch {
    return null;
  }
}

/** Absolute URI for a stored relative path, or null when missing on disk. */
export async function resolveEvidenceUri(relativePath: string | null): Promise<string | null> {
  if (!relativePath) return null;
  const uri = `${FileSystem.documentDirectory}${relativePath}`;
  const info = await FileSystem.getInfoAsync(uri);
  return info.exists ? uri : null;
}

export async function evidenceFileExists(relativePath: string | null): Promise<boolean> {
  if (!relativePath) return false;
  const info = await FileSystem.getInfoAsync(`${FileSystem.documentDirectory}${relativePath}`);
  return info.exists;
}
