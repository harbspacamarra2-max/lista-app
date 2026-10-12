import { Platform } from 'react-native';
import { parseISODate } from './format';
import { peso } from './format';

let Notifications = null;
try {
  Notifications = Platform.OS === 'web' ? null : require('expo-notifications');
} catch {
  Notifications = null;
}

export function setupNotifications() {
  if (!Notifications) return;
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
    if (Platform.OS === 'android') {
      Notifications.setNotificationChannelAsync('utang', {
        name: 'Utang reminders',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 200, 120, 200],
        lightColor: '#16A06A',
      }).catch(() => {});
      Notifications.setNotificationChannelAsync('daily', {
        name: 'Daily nudge',
        importance: Notifications.AndroidImportance.DEFAULT,
      }).catch(() => {});
    }
  } catch {
  }
}

export async function ensurePermission() {
  if (!Notifications) return false;
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    const asked = await Notifications.requestPermissionsAsync();
    return !!asked.granted;
  } catch {
    return false;
  }
}

export async function scheduleDueReminder({ dueDate, personName, direction, amount }) {
  if (!Notifications || !dueDate) return null;
  try {
    const when = parseISODate(dueDate);
    when.setHours(9, 0, 0, 0);
    if (when.getTime() <= Date.now() + 60 * 1000) return null;
    const ok = await ensurePermission();
    if (!ok) return null;
    const title = direction === 'owe' ? `Pay ${personName} today 💸` : `${personName}'s utang is due today 👀`;
    const body =
      direction === 'owe'
        ? `You owe ${personName} ${peso(amount)}. Settle up para walang stress!`
        : `${personName} owes you ${peso(amount)}. Time for a friendly reminder.`;
    return await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: true },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: when,
        channelId: 'utang',
      },
    });
  } catch {
    return null;
  }
}

export async function cancelReminder(id) {
  if (!Notifications || !id) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {
  }
}

const DAILY_KEY = 'lista-daily-nudge';

export async function setDailyNudge(enabled) {
  if (!Notifications) return false;
  try {
    const all = await Notifications.getAllScheduledNotificationsAsync();
    for (const n of all) {
      if (n.content?.data?.kind === DAILY_KEY) {
        await Notifications.cancelScheduledNotificationAsync(n.identifier);
      }
    }
    if (!enabled) return true;
    const ok = await ensurePermission();
    if (!ok) return false;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Gastos check! 👀',
        body: 'What did you buy today, bestie? Ilista mo na in 10 seconds.',
        data: { kind: DAILY_KEY },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: 20,
        minute: 0,
        channelId: 'daily',
      },
    });
    return true;
  } catch {
    return false;
  }
}
