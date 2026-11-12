import { getDb } from '../database';
import type { Reminder, ReminderType } from '../types';
import { newId } from './helpers';
import { nowUtcIso } from '../../domain/dates';

export interface UpsertReminderInput {
  project_item_id: string;
  reminder_type?: ReminderType;
  scheduled_at: string; // UTC ISO
  advance_minutes?: number | null;
  enabled?: boolean;
}

/** Replace any existing reminders for the item with a single enabled reminder. */
export function upsertItemReminder(input: UpsertReminderInput): Reminder {
  const db = getDb();
  const now = nowUtcIso();
  const id = newId();
  db.withTransactionSync(() => {
    db.runSync('DELETE FROM reminders WHERE project_item_id = ?', input.project_item_id);
    db.runSync(
      `INSERT INTO reminders (id, project_item_id, reminder_type, scheduled_at, advance_minutes, enabled, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      input.project_item_id,
      input.reminder_type ?? 'deadline',
      input.scheduled_at,
      input.advance_minutes ?? null,
      input.enabled === false ? 0 : 1,
      now,
      now,
    );
  });
  return getReminder(id)!;
}

export function getReminder(id: string): Reminder | null {
  return getDb().getFirstSync<Reminder>('SELECT * FROM reminders WHERE id = ?', id) ?? null;
}

export function listRemindersForItem(projectItemId: string): Reminder[] {
  return getDb().getAllSync<Reminder>(
    'SELECT * FROM reminders WHERE project_item_id = ? ORDER BY scheduled_at ASC',
    projectItemId,
  );
}

export function cancelItemReminders(projectItemId: string): void {
  getDb().runSync('DELETE FROM reminders WHERE project_item_id = ?', projectItemId);
}
