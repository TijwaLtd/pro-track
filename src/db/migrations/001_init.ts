// Migration 001 — initial schema per DATABASE.md (v1 amendments applied).
export const migration001 = `
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  start_date TEXT,
  target_end_date TEXT,
  status TEXT NOT NULL CHECK (status IN ('active','on_hold','completed','archived')),
  currency_code TEXT NOT NULL DEFAULT 'KES',
  color_key TEXT NOT NULL DEFAULT 'coral',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  archived_at TEXT
);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_target_end_date ON projects(target_end_date);

CREATE TABLE project_items (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  title TEXT NOT NULL,
  description TEXT,
  due_date TEXT,
  due_time TEXT,
  expected_amount_minor INTEGER CHECK (expected_amount_minor IS NULL OR expected_amount_minor >= 0),
  currency_code TEXT NOT NULL,
  completion_status TEXT NOT NULL DEFAULT 'open'
    CHECK (completion_status IN ('open','in_progress','completed','cancelled')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  avatar_key TEXT NOT NULL,
  completed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  archived_at TEXT
);
CREATE INDEX idx_items_project_due ON project_items(project_id, due_date);
CREATE INDEX idx_items_due_date ON project_items(due_date);
CREATE INDEX idx_items_completion_due ON project_items(completion_status, due_date);
CREATE INDEX idx_items_project_status ON project_items(project_id, completion_status);

CREATE TABLE payments (
  id TEXT PRIMARY KEY,
  project_item_id TEXT NOT NULL REFERENCES project_items(id) ON DELETE RESTRICT,
  amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
  currency_code TEXT NOT NULL,
  paid_at TEXT NOT NULL,
  method TEXT NOT NULL CHECK (method IN ('mpesa','cash','bank','card','other')),
  transaction_reference TEXT,
  raw_confirmation_text TEXT,
  counterparty TEXT,
  notes TEXT,
  record_status TEXT NOT NULL DEFAULT 'recorded' CHECK (record_status IN ('recorded','voided')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  voided_at TEXT,
  void_reason TEXT
);
CREATE INDEX idx_payments_item_paid ON payments(project_item_id, paid_at);
CREATE INDEX idx_payments_reference ON payments(transaction_reference);
CREATE INDEX idx_payments_status ON payments(record_status);

CREATE TABLE payment_evidence (
  id TEXT PRIMARY KEY,
  payment_id TEXT NOT NULL REFERENCES payments(id) ON DELETE RESTRICT,
  evidence_type TEXT NOT NULL CHECK (evidence_type IN ('pasted_text','image','pdf','document','other')),
  original_filename TEXT,
  relative_path TEXT,
  mime_type TEXT,
  byte_size INTEGER,
  checksum_sha256 TEXT,
  pasted_text TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_evidence_payment ON payment_evidence(payment_id);

CREATE TABLE activity_logs (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES projects(id) ON DELETE RESTRICT,
  project_item_id TEXT REFERENCES project_items(id) ON DELETE RESTRICT,
  payment_id TEXT REFERENCES payments(id) ON DELETE RESTRICT,
  event_type TEXT NOT NULL,
  summary TEXT NOT NULL,
  details_json TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_activity_project ON activity_logs(project_id, created_at);
CREATE INDEX idx_activity_item ON activity_logs(project_item_id, created_at);
CREATE INDEX idx_activity_payment ON activity_logs(payment_id, created_at);

CREATE TABLE reminders (
  id TEXT PRIMARY KEY,
  project_item_id TEXT NOT NULL REFERENCES project_items(id) ON DELETE RESTRICT,
  reminder_type TEXT NOT NULL CHECK (reminder_type IN ('deadline','payment','custom')),
  scheduled_at TEXT NOT NULL,
  advance_minutes INTEGER CHECK (advance_minutes IS NULL OR advance_minutes >= 0),
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0,1)),
  notification_identifier TEXT,
  last_scheduled_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_reminders_enabled_scheduled ON reminders(enabled, scheduled_at);
CREATE INDEX idx_reminders_item ON reminders(project_item_id);

CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
`;
