import { checkBudgets, getNewAlerts, getOverallHealth } from './budgetChecker';
import { sendBudgetNotification, setNotificationStore, getNotifSettings } from './notifications';
import { getStorageMode } from './storageMode';
import { supabase } from './db';
import { v4 as uuidv4 } from 'uuid';

export function runBudgetCheck(
  budgets: { category: string; monthly_limit: number }[],
  transactions: { category: string; amount: number; type: string; date: string }[],
  currency: string,
  userId?: string
) {
  if (!budgets.length) return;
  const settings = getNotifSettings();
  if (!settings.budgetAlerts) return;

  const alerts = checkBudgets(budgets, transactions);
  const newAlerts = getNewAlerts(alerts);

  for (const alert of newAlerts) {
    sendBudgetNotification(alert, currency);
  }
}

export function initNotificationStore(userId?: string) {
  setNotificationStore(async (title: string, body: string, type: string) => {
    const isLocal = getStorageMode() === 'local';
    const notif = {
      id: uuidv4(),
      user_id: userId || 'local',
      title,
      body,
      type,
      read: false,
      created_at: new Date().toISOString(),
    };

    if (isLocal) {
      const raw = localStorage.getItem('finfree_notifications');
      const list = raw ? JSON.parse(raw) : [];
      list.unshift(notif);
      if (list.length > 100) list.length = 100;
      localStorage.setItem('finfree_notifications', JSON.stringify(list));
    } else if (supabase) {
      await supabase.from('notifications').insert(notif);
    }
  });
}
