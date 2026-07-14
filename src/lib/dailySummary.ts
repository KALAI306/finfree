import { checkBudgets, getOverallHealth, type BudgetAlert } from './budgetChecker';

export type HealthStatus = 'GREEN' | 'YELLOW' | 'RED';

export interface DailySummary {
  todaySpent: number;
  weekSpent: number;
  monthSpent: number;
  topCategory: string | null;
  topCategoryAmount: number;
  remainingBudget: number;
  health: HealthStatus;
  budgetAlerts: BudgetAlert[];
  isNoSpendDay: boolean;
  transactionCount: number;
}

export interface WeeklySummary {
  weekSpent: number;
  transactionCount: number;
  topCategory: string | null;
  topCategoryAmount: number;
  savedAmount: number;
  health: HealthStatus;
}

export interface MonthlySummary {
  monthSpent: number;
  savingsRate: number;
  greenCategories: number;
  totalCategories: number;
}

function startOfDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function startOfWeek(d: Date): string {
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1;
  const mon = new Date(d);
  mon.setDate(mon.getDate() - diff);
  return startOfDay(mon);
}

function startOfMonth(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function mapHealth(h: 'green' | 'yellow' | 'red'): HealthStatus {
  return h.toUpperCase() as HealthStatus;
}

export function computeDailySummary(
  transactions: { category: string; amount: number; type: string; date: string }[],
  budgets: { category: string; monthly_limit: number }[],
  targetDate: Date = new Date()
): DailySummary {
  const today = startOfDay(targetDate);
  const weekStart = startOfWeek(targetDate);
  const monthStart = startOfMonth(targetDate);

  const expenses = transactions.filter(t => t.type === 'expense');

  const todayTxs = expenses.filter(t => t.date === today);
  const weekTxs = expenses.filter(t => t.date >= weekStart && t.date <= today);
  const monthTxs = expenses.filter(t => t.date >= monthStart && t.date <= today);

  const todaySpent = todayTxs.reduce((s, t) => s + t.amount, 0);
  const weekSpent = weekTxs.reduce((s, t) => s + t.amount, 0);
  const monthSpent = monthTxs.reduce((s, t) => s + t.amount, 0);

  const catSpend: Record<string, number> = {};
  for (const t of todayTxs) {
    catSpend[t.category] = (catSpend[t.category] || 0) + t.amount;
  }
  const topEntry = Object.entries(catSpend).sort((a, b) => b[1] - a[1])[0];

  const alerts = checkBudgets(budgets, transactions);
  const health = mapHealth(getOverallHealth(alerts));
  const remainingBudget = alerts.reduce((s, a) => s + a.remaining, 0);

  return {
    todaySpent,
    weekSpent,
    monthSpent,
    topCategory: topEntry?.[0] ?? null,
    topCategoryAmount: topEntry?.[1] ?? 0,
    remainingBudget,
    health,
    budgetAlerts: alerts,
    isNoSpendDay: todaySpent === 0,
    transactionCount: todayTxs.length,
  };
}

export function computeWeeklySummary(
  transactions: { category: string; amount: number; type: string; date: string }[],
  budgets: { category: string; monthly_limit: number }[],
  monthlySalary: number
): WeeklySummary {
  const now = new Date();
  const weekStart = startOfWeek(now);
  const today = startOfDay(now);

  const expenses = transactions.filter(t => t.type === 'expense' && t.date >= weekStart && t.date <= today);
  const weekSpent = expenses.reduce((s, t) => s + t.amount, 0);

  const catSpend: Record<string, number> = {};
  for (const t of expenses) {
    catSpend[t.category] = (catSpend[t.category] || 0) + t.amount;
  }
  const topEntry = Object.entries(catSpend).sort((a, b) => b[1] - a[1])[0];

  const weeklyBudget = monthlySalary / 4;
  const savedAmount = Math.max(0, weeklyBudget - weekSpent);

  const alerts = checkBudgets(budgets, transactions);
  const health = mapHealth(getOverallHealth(alerts));

  return {
    weekSpent,
    transactionCount: expenses.length,
    topCategory: topEntry?.[0] ?? null,
    topCategoryAmount: topEntry?.[1] ?? 0,
    savedAmount,
    health,
  };
}

export function computeMonthlySummary(
  transactions: { category: string; amount: number; type: string; date: string }[],
  budgets: { category: string; monthly_limit: number }[],
  monthlySalary: number
): MonthlySummary {
  const now = new Date();
  const monthStart = startOfMonth(now);
  const today = startOfDay(now);

  const monthExpenses = transactions.filter(t => t.type === 'expense' && t.date >= monthStart && t.date <= today);
  const monthSpent = monthExpenses.reduce((s, t) => s + t.amount, 0);

  const savingsRate = monthlySalary > 0 ? Math.round(((monthlySalary - monthSpent) / monthlySalary) * 100) : 0;

  const alerts = checkBudgets(budgets, transactions);
  const greenCategories = alerts.filter(a => a.level === 'SAFE').length;

  return {
    monthSpent,
    savingsRate,
    greenCategories,
    totalCategories: alerts.length,
  };
}

const MOTIVATIONAL = [
  (saved: number, fmt: (n: number) => string) => `${fmt(saved)} saved so far this month — keep it up!`,
  (_s: number, _f: (n: number) => string, daysLeft: number, remaining: number, fmt: (n: number) => string) =>
    `${daysLeft} days left in month — ${fmt(remaining)} remaining in budget`,
  () => `You're on track for your savings goal this month!`,
];

export function formatDailySummaryNotification(
  summary: DailySummary,
  fmt: (n: number) => string,
  monthlySalary: number
): { title: string; body: string } {
  if (summary.isNoSpendDay) {
    return {
      title: '🎯 No-spend day! Great job.',
      body: `Week total stays at ${fmt(summary.weekSpent)} 💪`,
    };
  }

  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysLeft = daysInMonth - now.getDate();
  const monthSaved = Math.max(0, monthlySalary - summary.monthSpent);

  const motivIdx = Math.floor(Math.random() * MOTIVATIONAL.length);
  const motivational = MOTIVATIONAL[motivIdx](monthSaved, fmt, daysLeft, summary.remainingBudget, fmt);

  if (summary.health === 'GREEN') {
    return {
      title: `✅ Good day! Spent ${fmt(summary.todaySpent)} today.`,
      body: `Week total ${fmt(summary.weekSpent)}. All budgets healthy 💚`,
    };
  }

  if (summary.health === 'YELLOW') {
    const warningCat = summary.budgetAlerts.find(a => a.level === 'WARNING');
    const catMsg = warningCat ? `${warningCat.category} budget at ${warningCat.percentage}%. ` : '';
    return {
      title: `⚠️ Spent ${fmt(summary.todaySpent)} today — ${catMsg}`,
      body: `${fmt(summary.remainingBudget)} left for remaining budgets. ${motivational}`,
    };
  }

  const exceededCat = summary.budgetAlerts.find(a => a.level === 'EXCEEDED' || a.level === 'DANGER');
  return {
    title: `🔴 Spent ${fmt(summary.todaySpent)} today. ${exceededCat?.category ?? ''} budget exceeded!`,
    body: `Review your spending in FinFree.`,
  };
}

export function formatWeeklySummaryNotification(
  summary: WeeklySummary,
  fmt: (n: number) => string
): { title: string; body: string } {
  let statusMsg: string;
  if (summary.health === 'GREEN') statusMsg = 'Great week! On track 🎯';
  else if (summary.health === 'YELLOW') statusMsg = 'Slightly over — adjust next week';
  else statusMsg = 'Review your spending plan 📋';

  return {
    title: `📊 Week recap: Spent ${fmt(summary.weekSpent)} across ${summary.transactionCount} transactions.`,
    body: `Top: ${summary.topCategory ?? 'None'} ${fmt(summary.topCategoryAmount)}. Saved ${fmt(summary.savedAmount)}. ${statusMsg}`,
  };
}

export function formatMonthlySummaryNotification(
  summary: MonthlySummary,
  fmt: (n: number) => string
): { title: string; body: string } {
  return {
    title: `📅 Month ending! Total spent: ${fmt(summary.monthSpent)}`,
    body: `Savings rate: ${summary.savingsRate}%. ${summary.greenCategories}/${summary.totalCategories} budget categories stayed green.`,
  };
}

export function formatMorningBriefing(
  yesterdaySummary: DailySummary,
  todayRemaining: number,
  fmt: (n: number) => string
): { title: string; body: string } {
  return {
    title: `☀️ Yesterday: ${fmt(yesterdaySummary.todaySpent)} spent.`,
    body: `Today's budget remaining: ${fmt(todayRemaining)}`,
  };
}

// ── No-Spend Day Tracking ──

const NO_SPEND_KEY = 'finfree_no_spend_days';

export function getNoSpendDays(): string[] {
  try {
    const raw = localStorage.getItem(NO_SPEND_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function recordNoSpendDay(date: string) {
  const days = getNoSpendDays();
  if (!days.includes(date)) {
    days.push(date);
    localStorage.setItem(NO_SPEND_KEY, JSON.stringify(days));
  }
}

export function getNoSpendStreak(): number {
  const now = new Date();
  const weekStart = startOfWeek(now);
  const days = getNoSpendDays().filter(d => d >= weekStart);
  return days.length;
}

export function getMonthNoSpendCount(): number {
  const monthStart = startOfMonth(new Date());
  return getNoSpendDays().filter(d => d >= monthStart).length;
}

export function getNoSpendMilestone(count: number): string | null {
  if (count === 1) return 'Your first no-spend day! 🎯';
  if (count === 5) return '5 no-spend days this month! 💪';
  if (count === 10) return '10 no-spend days! Finance hero 🏆';
  return null;
}

// ── Summary Cache ──

const SUMMARY_CACHE_KEY = 'finfree_daily_summary_cache';

export function cacheSummary(summary: DailySummary) {
  localStorage.setItem(SUMMARY_CACHE_KEY, JSON.stringify({
    date: startOfDay(new Date()),
    summary,
  }));
}

export function getCachedSummary(): DailySummary | null {
  try {
    const raw = localStorage.getItem(SUMMARY_CACHE_KEY);
    if (!raw) return null;
    const { date, summary } = JSON.parse(raw);
    if (date === startOfDay(new Date())) return summary;
  } catch {}
  return null;
}
