import { getDb } from '../database';
import type { Payment, PaymentMethod, PaymentEvidence, RecordStatus } from '../types';
import { newId, logActivity } from './helpers';
import { nowUtcIso } from '../../domain/dates';
import { getItem } from './items';
import { formatMoney } from '../../domain/money';

export interface CreatePaymentInput {
  project_item_id: string;
  amount_minor: number;
  currency_code?: string;
  paid_at: string; // UTC ISO
  method: PaymentMethod;
  transaction_reference?: string | null;
  raw_confirmation_text?: string | null;
  counterparty?: string | null;
  notes?: string | null;
}

export interface EvidenceInput {
  evidence_type: PaymentEvidence['evidence_type'];
  original_filename?: string | null;
  relative_path?: string | null;
  mime_type?: string | null;
  byte_size?: number | null;
  checksum_sha256?: string | null;
}

/** Single transaction: payment + evidence rows + activity log (DATABASE.md §6). */
export function createPayment(input: CreatePaymentInput, evidence: EvidenceInput[] = []): Payment {
  const db = getDb();
  const item = getItem(input.project_item_id);
  if (!item) throw new Error('Item not found');
  const currency = input.currency_code ?? item.currency_code;
  if (item.currency_code !== currency) {
    throw new Error('Payment currency must match item currency');
  }
  if (input.amount_minor <= 0) throw new Error('Amount must be positive');

  const now = nowUtcIso();
  const id = newId();
  db.withTransactionSync(() => {
    db.runSync(
      `INSERT INTO payments
        (id, project_item_id, amount_minor, currency_code, paid_at, method, transaction_reference,
         raw_confirmation_text, counterparty, notes, record_status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'recorded', ?, ?)`,
      id,
      input.project_item_id,
      input.amount_minor,
      currency,
      input.paid_at,
      input.method,
      input.transaction_reference ?? null,
      input.raw_confirmation_text ?? null,
      input.counterparty ?? null,
      input.notes ?? null,
      now,
      now,
    );
    for (const ev of evidence) {
      db.runSync(
        `INSERT INTO payment_evidence
          (id, payment_id, evidence_type, original_filename, relative_path, mime_type, byte_size, checksum_sha256, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        newId(),
        id,
        ev.evidence_type,
        ev.original_filename ?? null,
        ev.relative_path ?? null,
        ev.mime_type ?? null,
        ev.byte_size ?? null,
        ev.checksum_sha256 ?? null,
        now,
      );
    }
    logActivity(
      {
        project_id: item.project_id,
        project_item_id: item.id,
        payment_id: id,
        event_type: 'payment_recorded',
        summary: `Payment of ${formatMoney(input.amount_minor, currency)} recorded`,
        details_json: JSON.stringify({ method: input.method }),
      },
      db,
    );
  });
  return getPayment(id)!;
}

export function getPayment(id: string): Payment | null {
  return getDb().getFirstSync<Payment>('SELECT * FROM payments WHERE id = ?', id) ?? null;
}

export function listPaymentsForItem(projectItemId: string): Payment[] {
  return getDb().getAllSync<Payment>(
    'SELECT * FROM payments WHERE project_item_id = ? ORDER BY paid_at DESC, created_at DESC',
    projectItemId,
  );
}

export function listEvidenceForPayment(paymentId: string): PaymentEvidence[] {
  return getDb().getAllSync<PaymentEvidence>(
    'SELECT * FROM payment_evidence WHERE payment_id = ? ORDER BY created_at ASC',
    paymentId,
  );
}

/**
 * Duplicate warning check: identical pasted text (trimmed, whitespace collapsed)
 * on another recorded payment. Warn only — never blocks.
 */
export function findDuplicateRawText(rawText: string, excludePaymentId?: string): Payment | null {
  const normalize = (s: string) => s.trim().replace(/\s+/g, ' ');
  const needle = normalize(rawText);
  if (!needle) return null;
  const db = getDb();
  const rows = db.getAllSync<Payment>(
    "SELECT * FROM payments WHERE record_status = 'recorded' AND raw_confirmation_text IS NOT NULL",
  );
  for (const row of rows) {
    if (excludePaymentId && row.id === excludePaymentId) continue;
    if (row.raw_confirmation_text && normalize(row.raw_confirmation_text) === needle) {
      return row;
    }
  }
  return null;
}

export interface UpdatePaymentInput {
  amount_minor?: number;
  paid_at?: string;
  method?: PaymentMethod;
  raw_confirmation_text?: string | null;
  notes?: string | null;
}

export function updatePayment(id: string, patch: UpdatePaymentInput): void {
  const db = getDb();
  const fields: string[] = [];
  const params: (string | number | null)[] = [];
  const map: Record<keyof UpdatePaymentInput, string> = {
    amount_minor: 'amount_minor',
    paid_at: 'paid_at',
    method: 'method',
    raw_confirmation_text: 'raw_confirmation_text',
    notes: 'notes',
  };
  for (const key of Object.keys(patch) as (keyof UpdatePaymentInput)[]) {
    const value = patch[key];
    if (value === undefined) continue;
    fields.push(`${map[key]} = ?`);
    params.push(value === null ? null : (value as string | number));
  }
  if (fields.length === 0) return;
  fields.push('updated_at = ?');
  params.push(nowUtcIso(), id);
  db.withTransactionSync(() => {
    db.runSync(`UPDATE payments SET ${fields.join(', ')} WHERE id = ? AND record_status = 'recorded'`, ...params);
    logActivity(
      {
        project_id: null,
        project_item_id: null,
        payment_id: id,
        event_type: 'payment_updated',
        summary: 'Payment updated',
        details_json: JSON.stringify(patch),
      },
      db,
    );
  });
}

/** Void a payment — never hard-delete. Requires a reason; writes activity log. */
export function voidPayment(id: string, reason: string): void {
  const db = getDb();
  const payment = getPayment(id);
  if (!payment) throw new Error('Payment not found');
  if (payment.record_status === 'voided') throw new Error('Payment already voided');
  const now = nowUtcIso();
  db.withTransactionSync(() => {
    db.runSync(
      "UPDATE payments SET record_status = 'voided', voided_at = ?, void_reason = ?, updated_at = ? WHERE id = ?",
      now,
      reason.trim(),
      now,
      id,
    );
    logActivity(
      {
        project_id: null,
        project_item_id: payment.project_item_id,
        payment_id: id,
        event_type: 'payment_voided',
        summary: `Payment voided: ${reason.trim()}`,
        details_json: null,
      },
      db,
    );
  });
}

export function addEvidenceToPayment(paymentId: string, input: EvidenceInput): PaymentEvidence {
  const db = getDb();
  const payment = getPayment(paymentId);
  if (!payment) throw new Error('Payment not found');
  const id = newId();
  const now = nowUtcIso();
  db.withTransactionSync(() => {
    db.runSync(
      `INSERT INTO payment_evidence
        (id, payment_id, evidence_type, original_filename, relative_path, mime_type, byte_size, checksum_sha256, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      paymentId,
      input.evidence_type,
      input.original_filename ?? null,
      input.relative_path ?? null,
      input.mime_type ?? null,
      input.byte_size ?? null,
      input.checksum_sha256 ?? null,
      now,
    );
    logActivity(
      {
        project_id: null,
        project_item_id: payment.project_item_id,
        payment_id: paymentId,
        event_type: 'evidence_added',
        summary: `Evidence added to payment (${input.evidence_type})`,
        details_json: null,
      },
      db,
    );
  });
  return db.getFirstSync<PaymentEvidence>('SELECT * FROM payment_evidence WHERE id = ?', id)!;
}

export function removeEvidence(evidenceId: string): void {
  const db = getDb();
  db.runSync('DELETE FROM payment_evidence WHERE id = ?', evidenceId);
}

export function listAllPayments(): Payment[] {
  return getDb().getAllSync<Payment>('SELECT * FROM payments ORDER BY paid_at DESC');
}

export type { RecordStatus };
