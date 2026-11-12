import { describe, expect, it } from '@jest/globals';
import { itemAmounts, projectProgress, projectTotalsByCurrency, isEligibleItem, sumRecordedPayments } from './derived';
import type { Payment } from './types';

const pay = (amount_minor: number, record_status: 'recorded' | 'voided' = 'recorded') =>
  ({ amount_minor, record_status }) as Pick<Payment, 'amount_minor' | 'record_status'>;

describe('sumRecordedPayments', () => {
  it('sums recorded only', () => {
    expect(sumRecordedPayments([pay(100), pay(200), pay(999, 'voided')])).toBe(300);
  });
});

describe('itemAmounts', () => {
  it('not_applicable when no expected amount', () => {
    const a = itemAmounts({ expected_amount_minor: null }, [pay(500)]);
    expect(a.paymentStatus).toBe('not_applicable');
    expect(a.paidMinor).toBe(500);
    expect(a.outstandingMinor).toBeNull();
  });
  it('unpaid / partially_paid / paid', () => {
    expect(itemAmounts({ expected_amount_minor: 1000 }, []).paymentStatus).toBe('unpaid');
    expect(itemAmounts({ expected_amount_minor: 1000 }, [pay(400)]).paymentStatus).toBe('partially_paid');
    expect(itemAmounts({ expected_amount_minor: 1000 }, [pay(1000)]).paymentStatus).toBe('paid');
  });
  it('overpaid exposes overpaid amount and zero outstanding', () => {
    const a = itemAmounts({ expected_amount_minor: 1000 }, [pay(1500)]);
    expect(a.paymentStatus).toBe('overpaid');
    expect(a.overpaidMinor).toBe(500);
    expect(a.outstandingMinor).toBe(0);
  });
  it('voided payments do not count', () => {
    const a = itemAmounts({ expected_amount_minor: 1000 }, [pay(1000, 'voided')]);
    expect(a.paymentStatus).toBe('unpaid');
  });
});

describe('projectProgress', () => {
  const item = (s: string, archived: string | null = null) =>
    ({ completion_status: s, archived_at: archived }) as never;
  it('excludes cancelled and archived from denominator', () => {
    const r = projectProgress([item('completed'), item('open'), item('cancelled'), item('open', '2026-01-01')]);
    expect(r).toEqual({ done: 1, eligible: 2, ratio: 0.5 });
  });
  it('null ratio when nothing eligible', () => {
    expect(projectProgress([]).ratio).toBeNull();
    expect(projectProgress([item('cancelled')]).ratio).toBeNull();
  });
});

describe('isEligibleItem', () => {
  it('false for cancelled or archived', () => {
    expect(isEligibleItem({ completion_status: 'cancelled', archived_at: null } as never)).toBe(false);
    expect(isEligibleItem({ completion_status: 'open', archived_at: 'x' } as never)).toBe(false);
    expect(isEligibleItem({ completion_status: 'open', archived_at: null } as never)).toBe(true);
  });
});

describe('projectTotalsByCurrency', () => {
  it('never sums across currencies', () => {
    const items = [
      { id: 'a', expected_amount_minor: 1000, currency_code: 'KES', completion_status: 'open', archived_at: null },
      { id: 'b', expected_amount_minor: 2000, currency_code: 'USD', completion_status: 'open', archived_at: null },
      { id: 'c', expected_amount_minor: 500, currency_code: 'KES', completion_status: 'cancelled', archived_at: null },
    ] as never[];
    const payments = new Map([
      ['a', [pay(400)]],
      ['b', [pay(2000)]],
    ]);
    const totals = projectTotalsByCurrency(items, payments as never);
    expect(totals.get('KES')).toMatchObject({ plannedMinor: 1000, paidMinor: 400, outstandingMinor: 600 });
    expect(totals.get('USD')).toMatchObject({ plannedMinor: 2000, paidMinor: 2000, outstandingMinor: 0 });
    expect(totals.size).toBe(2);
  });
});
