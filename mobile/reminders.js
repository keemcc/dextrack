import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Daily reminders for long-acting (basal) insulin, as local notifications on the phone.
// The app only reminds - it never doses. Needs: npx expo install expo-notifications
// (loaded in a try/catch so the rest of the app still runs if it isn't installed yet).
let Notifications = null;
try {
  Notifications = require('expo-notifications');
} catch (e) {}

const KEY = 'insulinReminders';
const CHANNEL = 'insulin-reminders';

export const remindersAvailable = () => Notifications != null && Platform.OS !== 'web';

if (Notifications) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export async function loadReminders() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

const save = (list) => AsyncStorage.setItem(KEY, JSON.stringify(list)).catch(() => {});

async function ensurePermission() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL, {
      name: 'Insulin reminders',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const asked = await Notifications.requestPermissionsAsync();
  return !!asked.granted;
}

// hour is 0-23. Returns the updated list, or throws an Error with a message to show.
export async function addReminder({ hour, minute, label, units }) {
  if (!remindersAvailable()) throw new Error('Reminders need the expo-notifications package on a phone (not the web).');
  if (!(await ensurePermission())) throw new Error('Notifications are turned off - allow them in your phone settings.');

  const name = (label || '').trim() || 'Long-acting insulin';
  const body = units ? `Time for your ${name} (${units} units).` : `Time for your ${name}.`;

  const notificationId = await Notifications.scheduleNotificationAsync({
    content: { title: 'Insulin reminder', body, sound: true },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
      channelId: CHANNEL,
    },
  });

  const list = await loadReminders();
  const next = [...list, { id: notificationId, notificationId, hour, minute, label: name, units: units || '' }];
  next.sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute));
  await save(next);
  return next;
}

export async function removeReminder(id) {
  const list = await loadReminders();
  const target = list.find((r) => r.id === id);
  if (target && Notifications) {
    try {
      await Notifications.cancelScheduledNotificationAsync(target.notificationId);
    } catch (e) {}
  }
  const next = list.filter((r) => r.id !== id);
  await save(next);
  return next;
}

export const formatTime = (hour, minute) => {
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:${String(minute).padStart(2, '0')} ${hour < 12 ? 'AM' : 'PM'}`;
};
