import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import type { BudgetAlert } from './budgetChecker';

const SETTINGS_KEY = 'finfree_notif_settings';
const DAILY_COUNT_KEY = 'finfree_notif_daily_count';

export interface NotifSettings {
  budgetAlerts: boolean;
  dailySummary: boolean;
  dailySummaryHour: number;
  sound: boolean;
}

export function getNotifSettings(): NotifSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { budgetAlerts: false, dailySummary: false, dailySummaryHour: 21, sound: true };
}

export function saveNotifSettings(s: NotifSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

function isQuietHours(): boolean {
  const h = new Date().getHours();
  return h >= 23 || h < 8;
}

function getDailyCount(): number {
  try {
    const raw = localStorage.getItem(DAILY_COUNT_KEY);
    if (!raw) return 0;
    const { date, count } = JSON.parse(raw);
    if (date === new Date().toISOString().slice(0, 10)) return count;
  } catch {}
  return 0;
}

function incrementDailyCount() {
  const date = new Date().toISOString().slice(0, 10);
  const count = getDailyCount() + 1;
  localStorage.setItem(DAILY_COUNT_KEY, JSON.stringify({ date, count }));
}

function canNotify(): boolean {
  const settings = getNotifSettings();
  if (!settings.budgetAlerts) return false;
  if (isQuietHours()) return false;
  if (getDailyCount() >= 3) return false;
  return true;
}

export function formatAlertMessage(alert: BudgetAlert, currency: string): { title: string; body: string } {
  const fmt = (n: number) => `${currency}${n.toLocaleString()}`;
  switch (alert.level) {
    case 'WARNING':
      return {
        title: `⚠️ ${alert.category} budget at ${alert.percentage}%`,
        body: `${fmt(alert.spent)} of ${fmt(alert.limit)} used`,
      };
    case 'DANGER':
      return {
        title: `🔴 ${alert.category} budget almost full`,
        body: `Only ${fmt(alert.remaining)} left!`,
      };
    case 'EXCEEDED':
      return {
        title: `❌ ${alert.category} budget exceeded`,
        body: `Over by ${fmt(alert.spent - alert.limit)} this month`,
      };
    default:
      return { title: '', body: '' };
  }
}

export async function sendBudgetNotification(alert: BudgetAlert, currency: string): Promise<void> {
  if (!canNotify()) return;

  const { title, body } = formatAlertMessage(alert, currency);
  if (!title) return;

  incrementDailyCount();

  if (Capacitor.isNativePlatform()) {
    await LocalNotifications.schedule({
      notifications: [{
        title,
        body,
        id: Math.floor(Math.random() * 100000),
        schedule: { at: new Date() },
        sound: getNotifSettings().sound ? undefined : '',
        extra: { route: '/budgets' },
      }],
    });
  } else {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body, icon: '/icon-192.png' });
    }
  }

  await storeNotification(title, body, 'budget_alert');
}

export async function sendDailySummary(todaySpent: number, weekSpent: number, health: string, currency: string): Promise<void> {
  const settings = getNotifSettings();
  if (!settings.dailySummary) return;
  if (todaySpent === 0) return;
  if (isQuietHours()) return;

  const fmt = (n: number) => `${currency}${n.toLocaleString()}`;
  const statusEmoji = health === 'green' ? '🟢' : health === 'yellow' ? '🟡' : '🔴';
  const title = `Daily Spend: ${fmt(todaySpent)}`;
  const body = `This week ${fmt(weekSpent)}. Budget health: ${statusEmoji}`;

  if (Capacitor.isNativePlatform()) {
    await LocalNotifications.schedule({
      notifications: [{
        title,
        body,
        id: Math.floor(Math.random() * 100000),
        schedule: { at: new Date() },
        extra: { route: '/budgets' },
      }],
    });
  } else if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, { body, icon: '/icon-192.png' });
  }

  await storeNotification(title, body, 'daily_summary');
}

export async function scheduleDailySummary(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  const settings = getNotifSettings();
  if (!settings.dailySummary) return;

  const now = new Date();
  const scheduled = new Date();
  scheduled.setHours(settings.dailySummaryHour, 0, 0, 0);
  if (scheduled <= now) scheduled.setDate(scheduled.getDate() + 1);

  await LocalNotifications.schedule({
    notifications: [{
      title: 'Daily Spend Summary',
      body: 'Tap to see your spending today',
      id: 99999,
      schedule: { at: scheduled, every: 'day' },
      extra: { route: '/budgets' },
    }],
  });
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (Capacitor.isNativePlatform()) {
    const result = await LocalNotifications.requestPermissions();
    return result.display === 'granted';
  }
  if ('Notification' in window) {
    const result = await Notification.requestPermission();
    return result === 'granted';
  }
  return false;
}

export async function checkNotificationPermission(): Promise<boolean> {
  if (Capacitor.isNativePlatform()) {
    const result = await LocalNotifications.checkPermissions();
    return result.display === 'granted';
  }
  if ('Notification' in window) {
    return Notification.permission === 'granted';
  }
  return false;
}

let storeNotificationFn: ((title: string, body: string, type: string) => Promise<void>) | null = null;

export function setNotificationStore(fn: (title: string, body: string, type: string) => Promise<void>) {
  storeNotificationFn = fn;
}

async function storeNotification(title: string, body: string, type: string) {
  if (storeNotificationFn) await storeNotificationFn(title, body, type);
}

export async function sendTestNotification(): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    await LocalNotifications.schedule({
      notifications: [{
        title: '🔔 FinFree Notifications Active',
        body: 'Budget alerts are working! You\'ll be notified when spending nears limits.',
        id: Math.floor(Math.random() * 100000),
        schedule: { at: new Date() },
      }],
    });
  } else if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('🔔 FinFree Notifications Active', {
      body: 'Budget alerts are working!',
      icon: '/icon-192.png',
    });
  }
}
