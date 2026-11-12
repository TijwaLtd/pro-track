import { getDb } from '../database';
import type { Project, ProjectStatus } from '../types';
import { newId, logActivity } from './helpers';
import { nowUtcIso } from '../../domain/dates';

export interface CreateProjectInput {
  name: string;
  description?: string | null;
  start_date?: string | null;
  target_end_date?: string | null;
  currency_code?: string;
  color_key?: string;
}

export function createProject(input: CreateProjectInput): Project {
  const db = getDb();
  const now = nowUtcIso();
  const id = newId();
  db.withTransactionSync(() => {
    db.runSync(
      `INSERT INTO projects (id, name, description, start_date, target_end_date, status, currency_code, color_key, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?, ?)`,
      id,
      input.name.trim(),
      input.description ?? null,
      input.start_date ?? null,
      input.target_end_date ?? null,
      input.currency_code ?? 'KES',
      input.color_key ?? 'coral',
      now,
      now,
    );
    logActivity(
      {
        project_id: id,
        project_item_id: null,
        payment_id: null,
        event_type: 'project_created',
        summary: `Project "${input.name.trim()}" created`,
        details_json: null,
      },
      db,
    );
  });
  return getProject(id)!;
}

export function getProject(id: string): Project | null {
  return getDb().getFirstSync<Project>('SELECT * FROM projects WHERE id = ?', id) ?? null;
}

export function listProjects(status?: ProjectStatus | 'non_archived'): Project[] {
  const db = getDb();
  if (status === 'non_archived') {
    return db.getAllSync<Project>("SELECT * FROM projects WHERE status != 'archived' ORDER BY created_at DESC");
  }
  if (status) {
    return db.getAllSync<Project>('SELECT * FROM projects WHERE status = ? ORDER BY created_at DESC', status);
  }
  return db.getAllSync<Project>('SELECT * FROM projects ORDER BY created_at DESC');
}

export interface UpdateProjectInput {
  name?: string;
  description?: string | null;
  start_date?: string | null;
  target_end_date?: string | null;
  status?: ProjectStatus;
  color_key?: string;
}

export function updateProject(id: string, patch: UpdateProjectInput): void {
  const db = getDb();
  const fields: string[] = [];
  const params: (string | null)[] = [];
  const map: Record<keyof UpdateProjectInput, string> = {
    name: 'name',
    description: 'description',
    start_date: 'start_date',
    target_end_date: 'target_end_date',
    status: 'status',
    color_key: 'color_key',
  };
  for (const key of Object.keys(patch) as (keyof UpdateProjectInput)[]) {
    const value = patch[key];
    if (value === undefined) continue;
    fields.push(`${map[key]} = ?`);
    params.push(value === null ? null : String(value));
  }
  if (fields.length === 0) return;
  fields.push('updated_at = ?');
  params.push(nowUtcIso(), id);
  db.withTransactionSync(() => {
    db.runSync(`UPDATE projects SET ${fields.join(', ')} WHERE id = ?`, ...params);
    logActivity(
      {
        project_id: id,
        project_item_id: null,
        payment_id: null,
        event_type: 'project_updated',
        summary: 'Project updated',
        details_json: JSON.stringify(patch),
      },
      db,
    );
  });
}

export function archiveProject(id: string): void {
  const db = getDb();
  const now = nowUtcIso();
  db.withTransactionSync(() => {
    db.runSync(
      "UPDATE projects SET status = 'archived', archived_at = ?, updated_at = ? WHERE id = ?",
      now,
      now,
      id,
    );
    logActivity(
      {
        project_id: id,
        project_item_id: null,
        payment_id: null,
        event_type: 'project_archived',
        summary: 'Project archived',
        details_json: null,
      },
      db,
    );
  });
}
