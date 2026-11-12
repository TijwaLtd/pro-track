import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { getDb } from '../../db/database';
import type { Reminder } from '../../db/types';

/**
 * Reconciles DB reminders with OS-level local notifications.
 * Called on app start (after unlock) and after any reminder mutation.
 * Notifications carry { app: 'ProTrack', itemId, projectId } for tap-through.
 */

export const REMINDER_CHANNEL_ID = 'reminders';
const DATA_FLAG = 'ProTrack';

let handlerSet = false;
let channelReady = false;

function ensureHandler(): void {
  if (handlerSet) return;
  handlerSet = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

async function ensureChannel(): Promise<void> {
  if (channelReady) return;
  channelReady = true;
  if (Platform.OS !== 'android') return;
  try {
    await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL_ID, {
      name: 'Reminders',
      // eslint-disable-next-line import/namespace -- enum is re-exported via export *
      importance: Notifications.AndroidImportance.HIGH,
    });
  } catch {
    // Expo Go lacks the channel manager — scheduling still works without it.
  }
}

interface ReminderJoin extends Reminder {
  title: string;
  project_id: string;
  project_name: string;
  completion_status: string;
  archived_at: string | null;
}

function isSchedulable(r: ReminderJoin, now: number): boolean {
  if (!r.enabled) return false;
  const when = new Date(r.scheduled_at).getTime();
  if (Number.isNaN(when) || when <= now) return false;
  if (r.completion_status === 'completed' || r.completion_status === 'cancelled') return false;
  if (r.archived_at) return false;
  return true;
}

/** Cancel every notification we previously scheduled, then schedule current ones. */
export async function reconcileReminders(): Promise<void> {
  try {
    await reconcileRemindersInner();
  } catch {
    // Notifications are best-effort (Expo Go lacks full support) — never crash callers.
  }
}

async function reconcileRemindersInner(): Promise<void> {
  ensureHandler();
  await ensureChannel();

  const db = getDb();
  const rows = db.getAllSync<ReminderJoin>(
    `SELECT r.*, i.title, i.project_id, i.completion_status, i.archived_at, p.name AS project_name
     FROM reminders r
     JOIN project_items i ON i.id = r.project_item_id
     JOIN projects p ON p.id = i.project_id`,
  );

  // Only ask for permission when there is actually something to schedule.
  const now = Date.now();
  const pending = rows.filter((r) => isSchedulable(r, now));
  if (pending.length === 0) {
    // still clean up stale scheduled notifications
  } else {
    try {
      const perm = await Notifications.getPermissionsAsync();
      let granted = perm.granted;
      if (!granted && perm.canAskAgain) {
        granted = (await Notifications.requestPermissionsAsync()).granted;
      }
      if (!granted) return;
    } catch {
      return; // notifications unavailable (e.g. Expo Go) — skip silently
    }
  }

  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const n of scheduled) {
    const data = n.content.data as Record<string, unknown> | undefined;
    if (data?.app === DATA_FLAG) {
      await Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => {});
    }
  }

  for (const r of pending) {
    try {
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: r.title,
          body: `${r.project_name} · due reminder`,
          sound: true,
          data: { app: DATA_FLAG, itemId: r.project_item_id, projectId: r.project_id },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: new Date(r.scheduled_at),
          channelId: Platform.OS === 'android' ? REMINDER_CHANNEL_ID : undefined,
        },
      });
      db.runSync('UPDATE reminders SET notification_identifier = ?, last_scheduled_at = ? WHERE id = ?', id, new Date().toISOString(), r.id);
    } catch {
      // scheduling failed (e.g. too many pending) — reminder row stays for next reconcile
    }
  }
}
