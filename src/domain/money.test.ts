import { describe, expect, it } from '@jest/globals';
import { formatMoney, formatMoneyAmount, parseMoneyToMinor } from './money';

describe('parseMoneyToMinor', () => {
  it('parses plain amounts', () => {
    expect(parseMoneyToMinor('1200')).toBe(120000);
    expect(parseMoneyToMinor('0')).toBe(0);
  });
  it('parses decimals to minor units without floats', () => {
    expect(parseMoneyToMinor('12.5')).toBe(1250);
    expect(parseMoneyToMinor('12.05')).toBe(1205);
    expect(parseMoneyToMinor('0.07')).toBe(7);
  });
  it('handles thousands separators', () => {
    expect(parseMoneyToMinor('1,200.00')).toBe(120000);
  });
  it('rejects invalid input', () => {
    expect(parseMoneyToMinor('')).toBeNull();
    expect(parseMoneyToMinor('abc')).toBeNull();
    expect(parseMoneyToMinor('1.234')).toBeNull();
    expect(parseMoneyToMinor('1.2.3')).toBeNull();
  });
});

describe('formatMoney', () => {
  it('hides .00', () => {
    expect(formatMoney(1240000, 'KES')).toBe('KES 12,400');
  });
  it('shows cents when present', () => {
    expect(formatMoney(125050, 'KES')).toBe('KES 1,250.50');
    expect(formatMoney(7, 'KES')).toBe('KES 0.07');
  });
  it('handles negatives', () => {
    expect(formatMoney(-500, 'KES')).toBe('-KES 5');
  });
});

describe('formatMoneyAmount', () => {
  it('formats without currency', () => {
    expect(formatMoneyAmount(1240000)).toBe('12,400');
    expect(formatMoneyAmount(125050)).toBe('1,250.50');
  });
});
