import { createItem } from '../../db/repositories/items';
import { createPayment, type EvidenceInput } from '../../db/repositories/payments';
import { createProject } from '../../db/repositories/projects';
import { upsertItemReminder } from '../../db/repositories/reminders';
import type { PaymentMethod } from '../../db/types';
import { pickRandomAvatar } from '../../domain/avatars';
import { addDaysToDate, nowUtcIso, todayLocalDate } from '../../domain/dates';
import { parseMoneyToMinor } from '../../domain/money';
import { importEvidenceFile, type PickedFile } from '../../features/evidence/files';
import { reconcileReminders } from '../../features/reminders/scheduler';
import type { Answers, EvalContext } from './eval';
import type { FlowName } from './flows';

export interface ConfirmResult {
  payload?: Record<string, unknown>;
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

/** Per-flow confirm handlers — the `onConfirm` step actions from chat-forms.json. */
export async function confirmFlow(flow: FlowName, answers: Answers, ctx: EvalContext): Promise<ConfirmResult> {
  switch (flow) {
    case 'newProject': {
      const project = createProject({
        name: String(answers.name ?? ''),
        color_key: str(answers.color_key) ?? 'coral',
        target_end_date: str(answers.target_end_date),
      });
      return { payload: { projectId: project.id } };
    }
    case 'newItem': {
      const projectId = String(ctx.projectId ?? '');
      const hasCost = answers.has_cost === 'Yes';
      const dueDate = str(answers.due_date);
      const item = createItem({
        project_id: projectId,
        title: String(answers.title ?? ''),
        description: str(answers.description),
        due_date: dueDate,
        due_time: str(answers.due_time),
        expected_amount_minor: hasCost ? (typeof answers.expected_amount === 'number' ? answers.expected_amount : parseMoneyToMinor(String(answers.expected_amount))) : null,
        currency_code: String(ctx.currency ?? 'KES'),
        avatar_key: str(answers.avatar_key) ?? pickRandomAvatar().key,
      });
      // reminder step: "Yes, as usual" | "1 hour before" | "1 day before" | "No thanks"
      if (dueDate && answers.reminder && answers.reminder !== 'No thanks') {
        const advance =
          answers.reminder === '1 hour before' ? 60 :
          answers.reminder === '1 day before' ? 1440 : 60;
        const [y, m, d] = dueDate.split('-').map(Number);
        const due = new Date(y, m - 1, d);
        if (answers.due_time && /^\d{2}:\d{2}$/.test(String(answers.due_time))) {
          const [hh, mm] = String(answers.due_time).split(':').map(Number);
          due.setHours(hh, mm, 0, 0);
        }
        upsertItemReminder({
          project_item_id: item.id,
          scheduled_at: new Date(due.getTime() - advance * 60_000).toISOString(),
          advance_minutes: advance,
        });
        void reconcileReminders();
      }
      return { payload: { itemId: item.id } };
    }
    case 'newPayment': {
      const itemId = String(ctx.itemId ?? '');
      const amountMinor =
        typeof answers.amount === 'number' ? answers.amount : parseMoneyToMinor(String(answers.amount ?? ''));
      if (!itemId || amountMinor == null || amountMinor <= 0) {
        throw new Error('Payment needs an item and a positive amount');
      }
      const METHOD_MAP: Record<string, PaymentMethod> = {
        'M-Pesa': 'mpesa',
        Cash: 'cash',
        Bank: 'bank',
        Card: 'card',
        Other: 'other',
      };
      const method = METHOD_MAP[String(answers.method ?? 'M-Pesa')] ?? 'other';
      let paidAt = nowUtcIso();
      const rawWhen = str(answers.paid_at);
      if (rawWhen) {
        const d = new Date(rawWhen);
        if (!Number.isNaN(d.getTime())) paidAt = d.toISOString();
      }
      // copy picked evidence into app-private storage before the transaction
      const picked = Array.isArray(answers.evidence) ? (answers.evidence as PickedFile[]) : [];
      const evidence: EvidenceInput[] = [];
      for (const p of picked) {
        const stored = await importEvidenceFile(p);
        if (stored) evidence.push(stored);
      }
      const payment = createPayment(
        {
          project_item_id: itemId,
          amount_minor: amountMinor,
          currency_code: ctx.currency ? String(ctx.currency) : undefined,
          paid_at: paidAt,
          method,
          raw_confirmation_text: str(answers.raw_confirmation_text),
          notes: str(answers.notes),
        },
        evidence,
      );
      return { payload: { paymentId: payment.id, itemId } };
    }
    default:
      return {};
  }
}

export { addDaysToDate, nowUtcIso, todayLocalDate };

