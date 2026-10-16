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
      Notifications.setNotificationChannelAsync('bills', {
        name: 'Bill reminders',
        importance: Notifications.AndroidImportance.HIGH,
      }).catch(() => {});
    }
    Notifications.setNotificationCategoryAsync('daily_actions', [
      { identifier: 'log', buttonTitle: 'Log now ✍️', options: { opensAppToForeground: true } },
      { identifier: 'nospend', buttonTitle: 'Wala akong ginastos 😇', options: { opensAppToForeground: true } },
    ]).catch(() => {});
    Notifications.setNotificationCategoryAsync('bill_actions', [
      { identifier: 'paid', buttonTitle: 'Bayad na ✅', options: { opensAppToForeground: true } },
    ]).catch(() => {});
  } catch {
  }
}

export function onNotificationAction(handler) {
  if (!Notifications) return () => {};
  const seen = new Set();
  const handle = (response) => {
    if (!response) return;
    const id = response.notification?.request?.identifier + ':' + response.actionIdentifier;
    if (seen.has(id)) return;
    seen.add(id);
    handler({
      action: response.actionIdentifier,
      isDefault: response.actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER,
      data: response.notification?.request?.content?.data || {},
    });
  };
  Notifications.getLastNotificationResponseAsync().then(handle).catch(() => {});
  const sub = Notifications.addNotificationResponseReceivedListener(handle);
  return () => sub.remove();
}

export async function scheduleBillReminder({ date, name, amount, billId }) {
  if (!Notifications || !date) return null;
  try {
    const when = parseISODate(date);
    when.setHours(9, 0, 0, 0);
    if (when.getTime() <= Date.now() + 60 * 1000) return null;
    const ok = await ensurePermission();
    if (!ok) return null;
    return await Notifications.scheduleNotificationAsync({
      content: {
        title: `${name} is due today 🧾`,
        body: `${peso(amount)} — bayaran na bago makalimutan!`,
        data: { kind: 'bill', billId },
        categoryIdentifier: 'bill_actions',
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: when, channelId: 'bills' },
    });
  } catch {
    return null;
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
      content: { title, body, sound: true, data: { kind: 'utang' } },
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
        categoryIdentifier: 'daily_actions',
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

const WRAPPED_KEY = 'wrapped';

export async function scheduleWrappedReminder() {
  if (!Notifications) return false;
  try {
    const perm = await Notifications.getPermissionsAsync();
    if (!perm.granted) return false;
    const all = await Notifications.getAllScheduledNotificationsAsync();
    if (all.some((n) => n.content?.data?.kind === WRAPPED_KEY)) return true;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Your Sinop Wrapped is here! 🎁',
        body: 'Saan napunta pera mo last month? Tara, alamin natin. Brace yourself. 😭',
        data: { kind: WRAPPED_KEY },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.MONTHLY,
        day: 1,
        hour: 10,
        minute: 0,
        channelId: 'daily',
      },
    });
    return true;
  } catch {
    return false;
  }
}
