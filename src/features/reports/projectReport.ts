import * as Print from 'expo-print';

import { itemAmounts, projectProgress, projectStatusLabel, projectTotalsByCurrency } from '../../db/derived';
import { listItemsByProject } from '../../db/repositories/items';
import { listPaymentsForItem } from '../../db/repositories/payments';
import { getProject } from '../../db/repositories/projects';
import type { PaymentStatus, Project, ProjectItem } from '../../db/types';
import { formatDueDate } from '../../domain/dates';
import { formatMoney } from '../../domain/money';

/**
 * Project PDF report: a formatted HTML document rendered via expo-print.
 * Includes project meta, per-currency financial summary and a full item
 * table with payment status. Returned as a file URI for sharing.
 */

const ACCENT = '#FF6B6B';
const INK = '#111114';
const MUTED = '#6B6B76';
const LINE = '#E4E4E9';

const PAYMENT_LABELS: Record<PaymentStatus, string> = {
  unpaid: 'Unpaid',
  partially_paid: 'Partly paid',
  paid: 'Paid',
  overpaid: 'Overpaid',
  not_applicable: 'No cost',
};

const COMPLETION_LABELS: Record<ProjectItem['completion_status'], string> = {
  open: 'Open',
  in_progress: 'In progress',
  completed: 'Done',
  cancelled: 'Cancelled',
};

function esc(s: string | null | undefined): string {
  return (s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function money(minor: number | null, currency: string): string {
  return minor == null ? '—' : esc(formatMoney(minor, currency));
}

export function buildProjectReportHtml(project: Project, items: ProjectItem[]): string {
  const paymentsByItem = new Map(items.map((i) => [i.id, listPaymentsForItem(i.id)]));
  const totals = projectTotalsByCurrency(items, paymentsByItem);
  const progress = projectProgress(items);
  const generated = new Date().toLocaleString();

  const summaryRows = [...totals.entries()]
    .map(
      ([currency, t]) => `
      <tr>
        <td class="sum-cur">${esc(currency)}</td>
        <td class="num">${money(t.plannedMinor, currency)}</td>
        <td class="num">${money(t.paidMinor, currency)}</td>
        <td class="num">${money(t.outstandingMinor, currency)}</td>
      </tr>`,
    )
    .join('');

  const itemRows = items
    .map((item, idx) => {
      const amounts = itemAmounts(item, paymentsByItem.get(item.id) ?? []);
      const due = item.due_date
        ? `${esc(formatDueDate(item.due_date))}${item.due_time ? ` ${esc(item.due_time)}` : ''}`
        : '—';
      const archived = item.archived_at ? ' <span class="tag">archived</span>' : '';
      const desc = item.description ? `<div class="item-desc">${esc(item.description)}</div>` : '';
      return `
      <tr>
        <td class="idx">${idx + 1}</td>
        <td>
          <div class="item-title">${esc(item.title)}${archived}</div>${desc}
        </td>
        <td>${due}</td>
        <td>${esc(COMPLETION_LABELS[item.completion_status])}</td>
        <td class="num">${money(amounts.expectedMinor, item.currency_code)}</td>
        <td class="num">${money(amounts.paidMinor, item.currency_code)}</td>
        <td class="num">${money(amounts.outstandingMinor, item.currency_code)}</td>
        <td>${esc(PAYMENT_LABELS[amounts.paymentStatus])}</td>
      </tr>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: ${INK}; margin: 0; padding: 32px; font-size: 12px; }
  .brand { color: ${ACCENT}; font-weight: 700; font-size: 13px; letter-spacing: 0.5px; text-transform: uppercase; }
  h1 { font-size: 24px; margin: 8px 0 4px; }
  .meta { color: ${MUTED}; margin-bottom: 20px; }
  .meta span { margin-right: 16px; }
  h2 { font-size: 14px; margin: 24px 0 8px; border-bottom: 2px solid ${ACCENT}; padding-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.4px; color: ${MUTED}; border-bottom: 1px solid ${LINE}; padding: 6px 8px; }
  td { border-bottom: 1px solid ${LINE}; padding: 8px; vertical-align: top; }
  .num { text-align: right; white-space: nowrap; }
  th.num { text-align: right; }
  .idx { color: ${MUTED}; width: 24px; }
  .item-title { font-weight: 600; }
  .item-desc { color: ${MUTED}; font-size: 11px; margin-top: 2px; }
  .tag { font-size: 10px; color: ${MUTED}; border: 1px solid ${LINE}; border-radius: 8px; padding: 1px 6px; }
  .sum-cur { font-weight: 700; }
  .progress { margin: 4px 0 0; color: ${MUTED}; }
  .footer { margin-top: 28px; padding-top: 12px; border-top: 1px solid ${LINE}; color: ${MUTED}; font-size: 10px; }
</style></head><body>
  <div class="brand">ProTrack</div>
  <h1>${esc(project.name)}</h1>
  <div class="meta">
    <span>Status: ${esc(projectStatusLabel(project.status))}</span>
    <span>Currency: ${esc(project.currency_code)}</span>
    ${project.start_date ? `<span>Start: ${esc(formatDueDate(project.start_date))}</span>` : ''}
    ${project.target_end_date ? `<span>Target end: ${esc(formatDueDate(project.target_end_date))}</span>` : ''}
    <span>Items: ${progress.eligible} eligible · ${progress.done} done</span>
  </div>
  ${project.description ? `<p>${esc(project.description)}</p>` : ''}

  <h2>Financial summary</h2>
  <table>
    <tr><th>Currency</th><th class="num">Planned</th><th class="num">Paid</th><th class="num">Outstanding</th></tr>
    ${summaryRows || '<tr><td colspan="4" class="meta">No financial records.</td></tr>'}
  </table>
  <p class="progress">Progress: ${progress.eligible === 0 ? 'no eligible items' : `${progress.done}/${progress.eligible} items complete`}.</p>

  <h2>Items (${items.length})</h2>
  <table>
    <tr>
      <th class="idx">#</th><th>Item</th><th>Due</th><th>Status</th>
      <th class="num">Expected</th><th class="num">Paid</th><th class="num">Outstanding</th><th>Payment</th>
    </tr>
    ${itemRows || '<tr><td colspan="8" class="meta">No items yet.</td></tr>'}
  </table>

  <div class="footer">Generated by ProTrack on ${esc(generated)}. Local report — voided payments are excluded from totals.</div>
</body></html>`;
}

/** Render the project report to a PDF file. Returns the file URI. */
export async function exportProjectReport(projectId: string): Promise<string> {
  const project = getProject(projectId);
  if (!project) throw new Error('Project not found');
  const items = listItemsByProject(projectId, true);
  const html = buildProjectReportHtml(project, items);
  const { uri } = await Print.printToFileAsync({
    html,
    base64: false,
    width: 595,
    height: 842,
    margins: { top: 24, bottom: 24, left: 24, right: 24 },
  });
  return uri;
}
