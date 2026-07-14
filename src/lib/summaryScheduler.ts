import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { getNotifSettings } from './notifications';

const SCHEDULE_KEY = 'finfree_summary_schedule';

export interface SummaryScheduleSettings {
  dailySummary: boolean;
  dailySummaryHour: number;
  morningBriefing: boolean;
  morningBriefingHour: number;
  weeklySummary: boolean;
  monthEndSummary: boolean;
  noSpendCelebration: boolean;
}

const DEFAULTS: SummaryScheduleSettings = {
  dailySummary: true,
  dailySummaryHour: 21,
  morningBriefing: false,
  morningBriefingHour: 8,
  weeklySummary: true,
  monthEndSummary: true,
  noSpendCelebration: true,
};

export function getSummarySettings(): SummaryScheduleSettings {
  try {
    const raw = localStorage.getItem(SCHEDULE_KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {}
  return { ...DEFAULTS };
}

export function saveSummarySettings(s: SummaryScheduleSettings) {
  localStorage.setItem(SCHEDULE_KEY, JSON.stringify(s));
}

const NOTIF_IDS = {
  dailySummary: 88001,
  morningBriefing: 88002,
  weeklySummary: 88003,
  monthEnd: 88004,
};

function clampToQuietHours(hour: number): number {
  if (hour >= 23 || hour < 7) return 21;
  return hour;
}

export async function scheduleAllSummaryNotifications(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  const settings = getSummarySettings();

  await LocalNotifications.cancel({
    notifications: Object.values(NOTIF_IDS).map(id => ({ id })),
  });

  const notifications: any[] = [];

  if (settings.dailySummary) {
    const hour = clampToQuietHours(settings.dailySummaryHour);
    const at = nextOccurrence(hour);
    notifications.push({
      id: NOTIF_IDS.dailySummary,
      title: 'Daily Spend Summary',
      body: 'Tap to see your spending today',
      schedule: { at, every: 'day' },
      extra: { route: '/', type: 'daily_summary' },
    });
  }

  if (settings.morningBriefing) {
    const hour = clampToQuietHours(settings.morningBriefingHour);
    const at = nextOccurrence(hour);
    notifications.push({
      id: NOTIF_IDS.morningBriefing,
      title: '☀️ Morning Briefing',
      body: 'Tap to see yesterday\'s summary',
      schedule: { at, every: 'day' },
      extra: { route: '/', type: 'morning_briefing' },
    });
  }

  if (settings.weeklySummary) {
    const at = nextSunday(20);
    notifications.push({
      id: NOTIF_IDS.weeklySummary,
      title: '📊 Weekly Recap',
      body: 'Tap to see your week in review',
      schedule: { at, every: 'week' },
      extra: { route: '/', type: 'weekly_summary' },
    });
  }

  if (settings.monthEndSummary) {
    const at = lastDayOfMonth(19);
    notifications.push({
      id: NOTIF_IDS.monthEnd,
      title: '📅 Month-end Summary',
      body: 'Tap to review your month',
      schedule: { at },
      extra: { route: '/', type: 'month_end' },
    });
  }

  if (notifications.length > 0) {
    await LocalNotifications.schedule({ notifications });
  }
}

function nextOccurrence(hour: number): Date {
  const d = new Date();
  d.setHours(hour, 0, 0, 0);
  if (d <= new Date()) d.setDate(d.getDate() + 1);
  return d;
}

function nextSunday(hour: number): Date {
  const d = new Date();
  const day = d.getDay();
  const daysUntilSunday = day === 0 ? 7 : 7 - day;
  d.setDate(d.getDate() + daysUntilSunday);
  d.setHours(hour, 0, 0, 0);
  return d;
}

function lastDayOfMonth(hour: number): Date {
  const now = new Date();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  lastDay.setHours(hour, 0, 0, 0);
  if (lastDay <= now) {
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 2, 0);
    nextMonth.setHours(hour, 0, 0, 0);
    return nextMonth;
  }
  return lastDay;
}

// Web fallback: use setTimeout chains stored in memory
let webTimers: ReturnType<typeof setTimeout>[] = [];

export function scheduleWebSummaries(
  onDailySummary: () => void,
  onMorningBriefing: () => void
): void {
  webTimers.forEach(clearTimeout);
  webTimers = [];

  const settings = getSummarySettings();

  if (settings.dailySummary) {
    const ms = msUntilHour(clampToQuietHours(settings.dailySummaryHour));
    const t = setTimeout(() => {
      onDailySummary();
      scheduleWebSummaries(onDailySummary, onMorningBriefing);
    }, ms);
    webTimers.push(t);
  }

  if (settings.morningBriefing) {
    const ms = msUntilHour(clampToQuietHours(settings.morningBriefingHour));
    const t = setTimeout(() => {
      onMorningBriefing();
      scheduleWebSummaries(onDailySummary, onMorningBriefing);
    }, ms);
    webTimers.push(t);
  }
}

function msUntilHour(hour: number): number {
  const now = new Date();
  const target = new Date();
  target.setHours(hour, 0, 0, 0);
  if (target <= now) target.setDate(target.getDate() + 1);
  return target.getTime() - now.getTime();
}
