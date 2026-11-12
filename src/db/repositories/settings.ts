import { getDb } from '../database';

export type SettingsValue =
  | { lockTimeout: 'immediately' | '30s' | '1m' | '5m' }
  | { weekStart: 'monday' | 'sunday' }
  | { defaultReminder: 'at_due' | '1h' | '1d' }
  | { onboardingComplete: boolean }
  | Record<string, unknown>;

const DEFAULTS: Record<string, unknown> = {
  lockTimeout: '30s',
  weekStart: 'monday',
  defaultReminder: '1h',
  onboardingComplete: false,
};

export function getSetting<T = unknown>(key: string): T {
  const db = getDb();
  const row = db.getFirstSync<{ value_json: string }>('SELECT value_json FROM settings WHERE key = ?', key);
  if (!row) return DEFAULTS[key] as T;
  try {
    return JSON.parse(row.value_json) as T;
  } catch {
    return DEFAULTS[key] as T;
  }
}

export function setSetting(key: string, value: unknown): void {
  const db = getDb();
  db.runSync(
    `INSERT INTO settings (key, value_json, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at`,
    key,
    JSON.stringify(value),
    new Date().toISOString(),
  );
}

export type LockTimeout = 'immediately' | '30s' | '1m' | '5m';
export type WeekStart = 'monday' | 'sunday';
export type DefaultReminder = 'at_due' | '1h' | '1d';

interface SettingsShape {
  lockTimeout?: LockTimeout;
  weekStart?: WeekStart;
  defaultReminder?: DefaultReminder;
  onboardingComplete?: boolean;
}

function getAllSettings(): SettingsShape {
  return getSetting<SettingsShape>('settings') ?? {};
}

function updateSettings(patch: Partial<SettingsShape>): void {
  setSetting('settings', { ...getAllSettings(), ...patch });
}

export function getLockTimeout(): LockTimeout {
  return getAllSettings().lockTimeout ?? '30s';
}

export function setLockTimeout(v: LockTimeout): void {
  updateSettings({ lockTimeout: v });
}

export function getWeekStartPref(): WeekStart {
  return getAllSettings().weekStart ?? 'monday';
}

export function setWeekStartPref(v: WeekStart): void {
  updateSettings({ weekStart: v });
}

export function getDefaultReminder(): DefaultReminder {
  return getAllSettings().defaultReminder ?? '1h';
}

export function setDefaultReminder(v: DefaultReminder): void {
  updateSettings({ defaultReminder: v });
}

export function isOnboardingComplete(): boolean {
  return Boolean(getAllSettings().onboardingComplete);
}

export function setOnboardingComplete(v: boolean): void {
  updateSettings({ onboardingComplete: v });
}
