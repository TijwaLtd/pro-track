import type { SQLiteDatabase } from 'expo-sqlite';
import { getDb } from '../database';
import type { ActivityLog } from '../types';

export function newId(): string {
  // UUID v4 without extra deps
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function logActivity(
  entry: Omit<ActivityLog, 'id' | 'created_at'>,
  db: SQLiteDatabase = getDb(),
): void {
  db.runSync(
    `INSERT INTO activity_logs (id, project_id, project_item_id, payment_id, event_type, summary, details_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    newId(),
    entry.project_id,
    entry.project_item_id,
    entry.payment_id,
    entry.event_type,
    entry.summary,
    entry.details_json ?? null,
    new Date().toISOString(),
  );
}

export function listActivityForItem(projectItemId: string): ActivityLog[] {
  const db = getDb();
  return db.getAllSync<ActivityLog>(
    `SELECT * FROM activity_logs
     WHERE project_item_id = ?
        OR payment_id IN (SELECT id FROM payments WHERE project_item_id = ?)
     ORDER BY created_at DESC`,
    projectItemId,
    projectItemId,
  );
}
