import {
  addDays,
  format,
  isBefore,
  isSameDay,
  isToday,
  parseISO,
  startOfDay,
} from 'date-fns';

/** due_date is a floating local date 'YYYY-MM-DD'. due_time is 'HH:mm' or null. */
export type DueDate = string; // YYYY-MM-DD
export type DueTime = string; // HH:mm

export function todayLocalDate(): DueDate {
  return format(new Date(), 'yyyy-MM-dd');
}

export function addDaysToDate(date: DueDate, days: number): DueDate {
  return format(addDays(parseISO(date), days), 'yyyy-MM-dd');
}

/** Parse 'YYYY-MM-DD' as local midnight (never UTC). */
export function parseDueDate(date: DueDate): Date {
  return startOfDay(parseISO(date));
}

export function isDueToday(date: DueDate): boolean {
  return isToday(parseDueDate(date));
}

export function isOverdue(date: DueDate | null, completionStatus: string): boolean {
  if (!date) return false;
  if (completionStatus === 'completed' || completionStatus === 'cancelled') return false;
  return isBefore(parseDueDate(date), startOfDay(new Date()));
}

/** 'ddd, D MMM' — year appended only when not the current year. */
export function formatDueDate(date: DueDate | null): string {
  if (!date) return '';
  const d = parseDueDate(date);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return format(d, sameYear ? 'EEE, d MMM' : 'EEE, d MMM yyyy');
}

export function formatDueDateLong(date: DueDate | null): string {
  if (!date) return '';
  const d = parseDueDate(date);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return format(d, sameYear ? 'EEEE, d MMMM' : 'EEEE, d MMMM yyyy');
}

/** 'HH:mm' -> '14:30' (24h; device locale handling can be refined later). */
export function formatDueTime(time: DueTime | null): string {
  if (!time) return '';
  return time;
}

export function isSameDueDay(a: DueDate, b: Date): boolean {
  return isSameDay(parseDueDate(a), b);
}

/** UTC ISO timestamp for audit columns. */
export function nowUtcIso(): string {
  return new Date().toISOString();
}

/** Start of the week containing `date`. weekStart: 0=Sunday, 1=Monday. */
export function startOfWeek(date: Date, weekStart: 0 | 1): Date {
  const d = startOfDay(date);
  const day = d.getDay();
  const diff = (day - weekStart + 7) % 7;
  return addDays(d, -diff);
}

export function weekDatesContaining(date: Date, weekStart: 0 | 1, days = 7): DueDate[] {
  const start = startOfWeek(date, weekStart);
  return Array.from({ length: days }, (_, i) => format(addDays(start, i), 'yyyy-MM-dd'));
}
