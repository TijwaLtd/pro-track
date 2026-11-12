import { nowUtcIso } from '../../domain/dates';
import { getDb } from '../database';
import type { CompletionStatus, ProjectItem } from '../types';
import { logActivity, newId } from './helpers';

export interface CreateItemInput {
  project_id: string;
  title: string;
  description?: string | null;
  due_date?: string | null;
  due_time?: string | null;
  expected_amount_minor?: number | null;
  currency_code?: string;
  avatar_key: string;
  priority?: ProjectItem['priority'];
}

export function createItem(input: CreateItemInput): ProjectItem {
  const db = getDb();
  const now = nowUtcIso();
  const id = newId();
  db.withTransactionSync(() => {
    db.runSync(
      `INSERT INTO project_items
        (id, project_id, title, description, due_date, due_time, expected_amount_minor, currency_code, completion_status, priority, avatar_key, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?, ?, ?)`,
      id,
      input.project_id,
      input.title.trim(),
      input.description ?? null,
      input.due_date ?? null,
      input.due_time ?? null,
      input.expected_amount_minor ?? null,
      input.currency_code ?? 'KES',
      input.priority ?? 'normal',
      input.avatar_key,
      now,
      now,
    );
    logActivity(
      {
        project_id: input.project_id,
        project_item_id: id,
        payment_id: null,
        event_type: 'item_created',
        summary: `Item "${input.title.trim()}" added`,
        details_json: null,
      },
      db,
    );
  });
  return getItem(id)!;
}

export function getItem(id: string): ProjectItem | null {
  return getDb().getFirstSync<ProjectItem>('SELECT * FROM project_items WHERE id = ?', id) ?? null;
}

export function listItemsByProject(projectId: string, includeArchived = false): ProjectItem[] {
  const db = getDb();
  const base = 'SELECT * FROM project_items WHERE project_id = ?';
  const order = ' ORDER BY due_date IS NULL, due_date ASC, created_at ASC';
  if (includeArchived) {
    return db.getAllSync<ProjectItem>(`${base}${order}`, projectId);
  }
  return db.getAllSync<ProjectItem>(`${base} AND archived_at IS NULL${order}`, projectId);
}

/** Open/in-progress items due on a local date 'YYYY-MM-DD', for the Home hero/week strip. */
export function listOpenItemsDueOn(dueDate: string): (ProjectItem & { project_name: string; project_color_key: string })[] {
  const db = getDb();
  return db.getAllSync(
    `SELECT i.*, p.name AS project_name, p.color_key AS project_color_key
     FROM project_items i JOIN projects p ON p.id = i.project_id
     WHERE i.due_date = ? AND i.archived_at IS NULL
       AND i.completion_status IN ('open','in_progress')
       AND p.status != 'archived'
     ORDER BY i.due_time IS NULL, i.due_time ASC, i.priority DESC, i.created_at ASC`,
    dueDate,
  );
}

/** All open items with due dates in a range, joined with project colour for week-strip dots. */
export function listOpenItemsDueBetween(fromDate: string, toDate: string) {
  const db = getDb();
  return db.getAllSync<ProjectItem & { project_color_key: string }>(
    `SELECT i.*, p.color_key AS project_color_key
     FROM project_items i JOIN projects p ON p.id = i.project_id
     WHERE i.due_date >= ? AND i.due_date <= ? AND i.archived_at IS NULL
       AND i.completion_status IN ('open','in_progress')
       AND p.status != 'archived'`,
    fromDate,
    toDate,
  );
}

/** Next upcoming open items after a date, for the hero 'NEXT UP' fallback. */
export function listNextOpenItems(afterDate: string, limit = 5) {
  const db = getDb();
  return db.getAllSync<ProjectItem & { project_name: string; project_color_key: string }>(
    `SELECT i.*, p.name AS project_name, p.color_key AS project_color_key
     FROM project_items i JOIN projects p ON p.id = i.project_id
     WHERE i.due_date > ? AND i.archived_at IS NULL
       AND i.completion_status IN ('open','in_progress')
       AND p.status != 'archived'
     ORDER BY i.due_date ASC, i.due_time IS NULL, i.due_time ASC
     LIMIT ?`,
    afterDate,
    limit,
  );
}

export interface UpdateItemInput {
  title?: string;
  description?: string | null;
  due_date?: string | null;
  due_time?: string | null;
  expected_amount_minor?: number | null;
  completion_status?: CompletionStatus;
  priority?: ProjectItem['priority'];
  avatar_key?: string;
}

export function updateItem(id: string, patch: UpdateItemInput): void {
  const db = getDb();
  const fields: string[] = [];
  const params: (string | number | null)[] = [];
  const map: Record<keyof UpdateItemInput, string> = {
    title: 'title',
    description: 'description',
    due_date: 'due_date',
    due_time: 'due_time',
    expected_amount_minor: 'expected_amount_minor',
    completion_status: 'completion_status',
    priority: 'priority',
    avatar_key: 'avatar_key',
  };
  for (const key of Object.keys(patch) as (keyof UpdateItemInput)[]) {
    const value = patch[key];
    if (value === undefined) continue;
    fields.push(`${map[key]} = ?`);
    params.push(value === null ? null : (value as string | number));
  }
  if (fields.length === 0) return;
  fields.push('updated_at = ?');
  params.push(nowUtcIso(), id);
  db.withTransactionSync(() => {
    db.runSync(`UPDATE project_items SET ${fields.join(', ')} WHERE id = ?`, ...params);
    if (patch.completion_status === 'completed') {
      db.runSync('UPDATE project_items SET completed_at = ? WHERE id = ?', nowUtcIso(), id);
    } else if (patch.completion_status) {
      db.runSync('UPDATE project_items SET completed_at = NULL WHERE id = ?', id);
    }
    logActivity(
      {
        project_id: null,
        project_item_id: id,
        payment_id: null,
        event_type: patch.completion_status === 'completed' ? 'item_completed'
          : patch.completion_status ? 'item_reopened' : 'item_updated',
        summary: patch.completion_status === 'completed' ? 'Item marked done'
          : patch.completion_status ? 'Item reopened' : 'Item updated',
        details_json: JSON.stringify(patch),
      },
      db,
    );
  });
}

export function archiveItem(id: string): void {
  const db = getDb();
  const now = nowUtcIso();
  db.withTransactionSync(() => {
    db.runSync('UPDATE project_items SET archived_at = ?, updated_at = ? WHERE id = ?', now, now, id);
    logActivity(
      {
        project_id: null,
        project_item_id: id,
        payment_id: null,
        event_type: 'item_archived',
        summary: 'Item archived',
        details_json: null,
      },
      db,
    );
  });
}
