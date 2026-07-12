export type AlertLevel = 'SAFE' | 'WARNING' | 'DANGER' | 'EXCEEDED';

export interface BudgetAlert {
  category: string;
  level: AlertLevel;
  spent: number;
  limit: number;
  remaining: number;
  percentage: number;
}

export function getAlertLevel(spent: number, limit: number): AlertLevel {
  const pct = (spent / limit) * 100;
  if (pct >= 100) return 'EXCEEDED';
  if (pct >= 90) return 'DANGER';
  if (pct >= 70) return 'WARNING';
  return 'SAFE';
}

export function checkBudgets(
  budgets: { category: string; monthly_limit: number }[],
  transactions: { category: string; amount: number; type: string; date: string }[]
): BudgetAlert[] {
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

  const spendByCategory: Record<string, number> = {};
  for (const tx of transactions) {
    if (tx.type !== 'expense') continue;
    if (tx.date < monthStart) continue;
    spendByCategory[tx.category] = (spendByCategory[tx.category] || 0) + tx.amount;
  }

  return budgets.map(b => {
    const spent = spendByCategory[b.category] || 0;
    const level = getAlertLevel(spent, b.monthly_limit);
    return {
      category: b.category,
      level,
      spent,
      limit: b.monthly_limit,
      remaining: Math.max(0, b.monthly_limit - spent),
      percentage: Math.round((spent / b.monthly_limit) * 100),
    };
  });
}

const NOTIFIED_KEY = 'finfree_budget_notified';

interface NotifiedEntry {
  category: string;
  month: string;
  level: AlertLevel;
}

function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function getNotifiedThresholds(): NotifiedEntry[] {
  try {
    const raw = localStorage.getItem(NOTIFIED_KEY);
    if (!raw) return [];
    const entries: NotifiedEntry[] = JSON.parse(raw);
    const month = getCurrentMonth();
    return entries.filter(e => e.month === month);
  } catch { return []; }
}

function markNotified(category: string, level: AlertLevel) {
  const entries = getNotifiedThresholds();
  entries.push({ category, month: getCurrentMonth(), level });
  localStorage.setItem(NOTIFIED_KEY, JSON.stringify(entries));
}

const LEVEL_PRIORITY: Record<AlertLevel, number> = { SAFE: 0, WARNING: 1, DANGER: 2, EXCEEDED: 3 };

export function getNewAlerts(alerts: BudgetAlert[]): BudgetAlert[] {
  const notified = getNotifiedThresholds();
  const newAlerts: BudgetAlert[] = [];

  for (const alert of alerts) {
    if (alert.level === 'SAFE') continue;

    const prev = notified.filter(n => n.category === alert.category);
    const maxNotified = prev.reduce((max, n) => Math.max(max, LEVEL_PRIORITY[n.level]), 0);

    if (LEVEL_PRIORITY[alert.level] > maxNotified) {
      newAlerts.push(alert);
      markNotified(alert.category, alert.level);
    }
  }

  return newAlerts;
}

export function getOverallHealth(alerts: BudgetAlert[]): 'green' | 'yellow' | 'red' {
  if (alerts.some(a => a.level === 'EXCEEDED' || a.level === 'DANGER')) return 'red';
  if (alerts.some(a => a.level === 'WARNING')) return 'yellow';
  return 'green';
}
