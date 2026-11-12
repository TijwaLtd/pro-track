export type ProjectStatus = 'active' | 'on_hold' | 'completed' | 'archived';
export type CompletionStatus = 'open' | 'in_progress' | 'completed' | 'cancelled';
export type PaymentMethod = 'mpesa' | 'cash' | 'bank' | 'card' | 'other';
export type RecordStatus = 'recorded' | 'voided';
export type PaymentStatus = 'unpaid' | 'partially_paid' | 'paid' | 'overpaid' | 'not_applicable';
export type ReminderType = 'deadline' | 'payment' | 'custom';
export type EvidenceType = 'image' | 'pdf' | 'document' | 'other';

export interface Project {
  id: string;
  name: string;
  description: string | null;
  start_date: string | null;
  target_end_date: string | null;
  status: ProjectStatus;
  currency_code: string;
  color_key: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

export interface ProjectItem {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  due_time: string | null;
  expected_amount_minor: number | null;
  currency_code: string;
  completion_status: CompletionStatus;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  avatar_key: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

export interface Payment {
  id: string;
  project_item_id: string;
  amount_minor: number;
  currency_code: string;
  paid_at: string;
  method: PaymentMethod;
  transaction_reference: string | null;
  raw_confirmation_text: string | null;
  counterparty: string | null;
  notes: string | null;
  record_status: RecordStatus;
  created_at: string;
  updated_at: string;
  voided_at: string | null;
  void_reason: string | null;
}

export interface PaymentEvidence {
  id: string;
  payment_id: string;
  evidence_type: EvidenceType;
  original_filename: string | null;
  relative_path: string | null;
  mime_type: string | null;
  byte_size: number | null;
  checksum_sha256: string | null;
  pasted_text: string | null;
  created_at: string;
}

export interface ActivityLog {
  id: string;
  project_id: string | null;
  project_item_id: string | null;
  payment_id: string | null;
  event_type: string;
  summary: string;
  details_json: string | null;
  created_at: string;
}

export interface Reminder {
  id: string;
  project_item_id: string;
  reminder_type: ReminderType;
  scheduled_at: string;
  advance_minutes: number | null;
  enabled: number;
  notification_identifier: string | null;
  last_scheduled_at: string | null;
  created_at: string;
  updated_at: string;
}
