/**
 * Money is stored as integer minor units (1/100 of the currency unit, including KES).
 * Never use floats for money. Format only at the UI edge via formatMoney().
 */

export type CurrencyCode = string; // ISO 4217, e.g. 'KES'

/** Parse a user-entered decimal string ("1,200.50", "1200") into minor units. Returns null when invalid. */
export function parseMoneyToMinor(input: string): number | null {
  const cleaned = input.replace(/[\s,]/g, '').replace(/[^0-9.\-]/g, '');
  if (cleaned === '' || cleaned === '-' || cleaned === '.') return null;
  if ((cleaned.match(/\./g) || []).length > 1) return null;
  const negative = cleaned.startsWith('-');
  const abs = negative ? cleaned.slice(1) : cleaned;
  const [whole, frac = ''] = abs.split('.');
  if (frac.length > 2) return null;
  if (whole === '' && frac === '') return null;
  const minor = Number(whole || '0') * 100 + Number((frac + '00').slice(0, 2) || '0');
  if (!Number.isSafeInteger(minor)) return null;
  return negative ? -minor : minor;
}

/** Format minor units for display: "KES 12,400"; shows ".50" when present, hides ".00". */
export function formatMoney(minor: number, currency: CurrencyCode): string {
  const negative = minor < 0;
  const abs = Math.abs(minor);
  const whole = Math.floor(abs / 100);
  const frac = abs % 100;
  const wholeStr = whole.toLocaleString('en-US');
  const fracStr = frac === 0 ? '' : `.${String(frac).padStart(2, '0')}`;
  return `${negative ? '-' : ''}${currency} ${wholeStr}${fracStr}`;
}

/** Format minor units without the currency code, for compact badges: "12,400". */
export function formatMoneyAmount(minor: number): string {
  const negative = minor < 0;
  const abs = Math.abs(minor);
  const whole = Math.floor(abs / 100);
  const frac = abs % 100;
  const wholeStr = whole.toLocaleString('en-US');
  const fracStr = frac === 0 ? '' : `.${String(frac).padStart(2, '0')}`;
  return `${negative ? '-' : ''}${wholeStr}${fracStr}`;
}
