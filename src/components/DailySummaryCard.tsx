import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { computeDailySummary, getNoSpendStreak, getMonthNoSpendCount, getCachedSummary, cacheSummary, type DailySummary } from '../lib/dailySummary';
import { Flame, TrendingDown, ChevronRight, ShieldCheck, AlertTriangle, XCircle } from 'lucide-react';

export const DailySummaryCard: React.FC = () => {
  const { transactions, budgetLimits, fmt } = useApp();
  const [summary, setSummary] = useState<DailySummary | null>(getCachedSummary);

  useEffect(() => {
    const budgets = Object.entries(budgetLimits).map(([category, monthly_limit]) => ({ category, monthly_limit }));
    const s = computeDailySummary(transactions, budgets);
    setSummary(s);
    cacheSummary(s);
  }, [transactions, budgetLimits]);

  if (!summary) return null;

  const noSpendStreak = getNoSpendStreak();
  const monthNoSpend = getMonthNoSpendCount();

  const healthColor = summary.health === 'GREEN' ? 'text-emerald-500' : summary.health === 'YELLOW' ? 'text-amber-500' : 'text-red-500';
  const healthBg = summary.health === 'GREEN' ? 'bg-emerald-500/10' : summary.health === 'YELLOW' ? 'bg-amber-500/10' : 'bg-red-500/10';
  const healthBorder = summary.health === 'GREEN' ? 'border-emerald-500/20' : summary.health === 'YELLOW' ? 'border-amber-500/20' : 'border-red-500/20';
  const HealthIcon = summary.health === 'GREEN' ? ShieldCheck : summary.health === 'YELLOW' ? AlertTriangle : XCircle;

  return (
    <Link to="/reports" className="block">
      <div className={`glass-card rounded-2xl p-4 border ${healthBorder} hover:border-primary/20 transition-colors cursor-pointer`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-lg ${healthBg} flex items-center justify-center`}>
              <HealthIcon className={`w-3.5 h-3.5 ${healthColor}`} />
            </div>
            <span className="text-xs font-semibold text-foreground">Today's Spending</span>
          </div>
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
        </div>

        {summary.isNoSpendDay ? (
          <div className="flex items-center gap-3">
            <span className="text-2xl font-bold text-emerald-500">🎯 No-spend day!</span>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            <div>
              <p className="text-[10px] text-muted-foreground">Today</p>
              <p className="text-lg font-bold font-mono">{fmt(summary.todaySpent)}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">This Week</p>
              <p className="text-sm font-semibold font-mono text-muted-foreground">{fmt(summary.weekSpent)}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">This Month</p>
              <p className="text-sm font-semibold font-mono text-muted-foreground">{fmt(summary.monthSpent)}</p>
            </div>
          </div>
        )}

        <div className="flex items-center gap-3 mt-3 pt-3 border-t border-border/30">
          {summary.topCategory && !summary.isNoSpendDay && (
            <div className="flex items-center gap-1.5">
              <TrendingDown className="w-3 h-3 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground">Top: <span className="text-foreground font-medium">{summary.topCategory}</span></span>
            </div>
          )}

          {noSpendStreak > 0 && (
            <div className="flex items-center gap-1">
              <Flame className="w-3 h-3 text-orange-500" />
              <span className="text-[10px] text-muted-foreground">
                <span className="text-foreground font-medium">{noSpendStreak}</span> no-spend this week
              </span>
            </div>
          )}

          {summary.budgetAlerts.length > 0 && (
            <div className="ml-auto">
              <span className={`text-[10px] font-medium ${healthColor}`}>
                {summary.health === 'GREEN' ? 'All budgets OK' : summary.health === 'YELLOW' ? 'Budget warning' : 'Over budget'}
              </span>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
};
