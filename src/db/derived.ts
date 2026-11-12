import type { CompletionStatus, Payment, PaymentStatus, Project, ProjectItem } from './types';

export interface ItemAmounts {
  paidMinor: number;
  expectedMinor: number | null;
  /** expected - paid; negative means overpaid */
  balanceMinor: number | null;
  /** max(0, balance) for display as outstanding */
  outstandingMinor: number | null;
  overpaidMinor: number;
  paymentStatus: PaymentStatus;
}

/** Sum of recorded (non-voided) payments for an item. Payments are assumed same currency as item (validated at write). */
export function sumRecordedPayments(payments: Pick<Payment, 'amount_minor' | 'record_status'>[]): number {
  return payments
    .filter((p) => p.record_status === 'recorded')
    .reduce((acc, p) => acc + p.amount_minor, 0);
}

export function itemAmounts(item: Pick<ProjectItem, 'expected_amount_minor'>, payments: Pick<Payment, 'amount_minor' | 'record_status'>[]): ItemAmounts {
  const paidMinor = sumRecordedPayments(payments);
  const expectedMinor = item.expected_amount_minor;

  if (expectedMinor == null) {
    return {
      paidMinor,
      expectedMinor: null,
      balanceMinor: null,
      outstandingMinor: null,
      overpaidMinor: paidMinor > 0 ? paidMinor : 0,
      paymentStatus: 'not_applicable',
    };
  }

  const balanceMinor = expectedMinor - paidMinor;
  const overpaidMinor = balanceMinor < 0 ? -balanceMinor : 0;
  const outstandingMinor = Math.max(0, balanceMinor);

  let paymentStatus: PaymentStatus;
  if (paidMinor === 0) paymentStatus = 'unpaid';
  else if (balanceMinor > 0) paymentStatus = 'partially_paid';
  else if (balanceMinor === 0) paymentStatus = 'paid';
  else paymentStatus = 'overpaid';

  return { paidMinor, expectedMinor, balanceMinor, outstandingMinor, overpaidMinor, paymentStatus };
}

/** completion_status is independent of payment status — never inferred. */
export function isItemDone(status: CompletionStatus): boolean {
  return status === 'completed';
}

/** Items counted for progress/totals: exclude cancelled and archived. */
export function isEligibleItem(item: Pick<ProjectItem, 'completion_status' | 'archived_at'>): boolean {
  return item.completion_status !== 'cancelled' && item.archived_at == null;
}

export function projectProgress(items: Pick<ProjectItem, 'completion_status' | 'archived_at'>[]): {
  done: number;
  eligible: number;
  ratio: number | null; // null when no eligible items
} {
  const eligible = items.filter(isEligibleItem);
  const done = eligible.filter((i) => i.completion_status === 'completed').length;
  return { done, eligible: eligible.length, ratio: eligible.length === 0 ? null : done / eligible.length };
}

export interface CurrencyTotals {
  plannedMinor: number;
  paidMinor: number;
  outstandingMinor: number;
  overpaidMinor: number;
}

/**
 * Project financial totals, grouped per currency — never summed across currencies.
 * `itemPayments` maps item id -> its payments.
 */
export function projectTotalsByCurrency(
  items: (Pick<ProjectItem, 'id' | 'expected_amount_minor' | 'currency_code' | 'completion_status' | 'archived_at'>)[],
  itemPayments: Map<string, Pick<Payment, 'amount_minor' | 'record_status' | 'currency_code'>[]>,
): Map<string, CurrencyTotals> {
  const totals = new Map<string, CurrencyTotals>();
  const bump = (currency: string) => {
    let t = totals.get(currency);
    if (!t) {
      t = { plannedMinor: 0, paidMinor: 0, outstandingMinor: 0, overpaidMinor: 0 };
      totals.set(currency, t);
    }
    return t;
  };

  for (const item of items) {
    if (!isEligibleItem(item)) continue;
    const currency = item.currency_code;
    const amounts = itemAmounts(item, itemPayments.get(item.id) ?? []);
    const t = bump(currency);
    if (amounts.expectedMinor != null) t.plannedMinor += amounts.expectedMinor;
    t.paidMinor += amounts.paidMinor;
    if (amounts.outstandingMinor != null) t.outstandingMinor += amounts.outstandingMinor;
    t.overpaidMinor += amounts.overpaidMinor;
  }
  return totals;
}

/** True when a project's items all share one currency (UI may show a single outstanding figure). */
export function singleCurrency(items: Pick<ProjectItem, 'currency_code'>[]): string | null {
  if (items.length === 0) return null;
  const first = items[0].currency_code;
  return items.every((i) => i.currency_code === first) ? first : null;
}

export function projectStatusLabel(status: Project['status']): string {
  switch (status) {
    case 'active': return 'Active';
    case 'on_hold': return 'On hold';
    case 'completed': return 'Completed';
    case 'archived': return 'Archived';
  }
}
