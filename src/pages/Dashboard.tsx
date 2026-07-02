import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { formatIndianNumberOnly } from "../lib/utils";
import { getDailyQuote } from "../lib/quotes";
import {
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  TrendingUp,
  AlertTriangle,
  ChevronRight,
  Star,
  Flame,
  Sparkles,
  Target,
  CreditCard,
  BarChart3,
  Zap,
  ArrowRightLeft,
  Quote,
  Cloud,
  HardDrive,
  RefreshCw,
  PiggyBank,
  CheckCircle2,
} from "lucide-react";
import { Modal } from "../components/Modal";
import { TransactionForm } from "./Transactions.tsx";
import { localDb, type NetWorthSnapshot } from "../lib/localdb";

// ── Net Worth History Chart ─────────────────────────────────────────────────

const NwChart: React.FC<{ data: NetWorthSnapshot[]; accentColor: string }> = ({ data, accentColor }) => {
  const [tooltip, setTooltip] = React.useState<{ x: number; y: number; val: number; label: string } | null>(null);

  const W = 600, H = 160, PAD = { t: 12, r: 16, b: 32, l: 10 };
  const innerW = W - PAD.l - PAD.r;
  const innerH = H - PAD.t - PAD.b;

  const vals  = data.map(s => s.net_worth);
  const min   = Math.min(...vals);
  const max   = Math.max(...vals);
  const range = max - min || 1;
  const n     = vals.length;

  const px = (i: number) => PAD.l + (i / (n - 1)) * innerW;
  const py = (v: number) => PAD.t + innerH - ((v - min) / range) * innerH;

  // Smooth bezier path
  const points = vals.map((v, i) => ({ x: px(i), y: py(v) }));
  let linePath = `M ${points[0].x},${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const cp1x = points[i - 1].x + (points[i].x - points[i - 1].x) * 0.5;
    const cp2x = points[i].x - (points[i].x - points[i - 1].x) * 0.5;
    linePath += ` C ${cp1x},${points[i - 1].y} ${cp2x},${points[i].y} ${points[i].x},${points[i].y}`;
  }
  const areaPath = `${linePath} L ${points[n - 1].x},${H - PAD.b} L ${points[0].x},${H - PAD.b} Z`;

  // Y-axis grid: 3 lines
  const gridVals = [min, min + range * 0.5, max];
  const fmt = (v: number) => v >= 1e7 ? `₹${(v / 1e7).toFixed(1)}Cr` : v >= 1e5 ? `₹${(v / 1e5).toFixed(1)}L` : `₹${Math.round(v / 1000)}K`;

  return (
    <div className="space-y-1">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full overflow-visible"
        style={{ height: 180 }}
        onMouseLeave={() => setTooltip(null)}
      >
        <defs>
          <linearGradient id="nwAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={accentColor} stopOpacity="0.25" />
            <stop offset="80%"  stopColor={accentColor} stopOpacity="0.04" />
            <stop offset="100%" stopColor={accentColor} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Horizontal grid lines */}
        {gridVals.map((gv, i) => (
          <g key={i}>
            <line
              x1={PAD.l} y1={py(gv)} x2={W - PAD.r} y2={py(gv)}
              stroke="currentColor" strokeOpacity="0.07" strokeWidth="1" strokeDasharray="3 4"
              className="text-foreground"
            />
            <text x={PAD.l - 4} y={py(gv) + 3.5} textAnchor="end" fontSize="9" fill="currentColor" fillOpacity="0.4" className="text-foreground">
              {fmt(gv)}
            </text>
          </g>
        ))}

        {/* Area fill */}
        <path d={areaPath} fill="url(#nwAreaGrad)" />

        {/* Line */}
        <path d={linePath} fill="none" stroke={accentColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

        {/* Month labels on X-axis */}
        {points.map((pt, i) => {
          const raw   = data[i].month;           // e.g. "2026-07"
          const parts = raw.split('-');
          const label = parts.length >= 2
            ? new Date(Number(parts[0]), Number(parts[1]) - 1, 1).toLocaleString('en-IN', { month: 'short' })
            : raw.slice(5);
          const showLabel = n <= 6 || i % Math.ceil(n / 6) === 0 || i === n - 1;
          return showLabel ? (
            <text key={i} x={pt.x} y={H - 4} textAnchor="middle" fontSize="9.5" fill="currentColor" fillOpacity="0.45" className="text-foreground">{label}</text>
          ) : null;
        })}

        {/* Interactive dots */}
        {points.map((pt, i) => (
          <g key={i} className="cursor-pointer" onMouseEnter={() => setTooltip({ x: pt.x, y: pt.y, val: vals[i], label: data[i].month })}>
            <circle cx={pt.x} cy={pt.y} r="14" fill="transparent" />
            <circle cx={pt.x} cy={pt.y} r={tooltip?.label === data[i].month ? 5 : 3.5} fill={accentColor} strokeWidth={tooltip?.label === data[i].month ? 2 : 0} stroke="hsl(var(--background))" />
          </g>
        ))}

        {/* Tooltip */}
        {tooltip && (() => {
          const raw    = tooltip.label.split('-');
          const month  = raw.length >= 2 ? new Date(Number(raw[0]), Number(raw[1]) - 1, 1).toLocaleString('en-IN', { month: 'short', year: '2-digit' }) : tooltip.label;
          const tw     = 110, th = 36;
          const tx     = Math.min(Math.max(tooltip.x - tw / 2, PAD.l), W - PAD.r - tw);
          const ty     = tooltip.y - th - 10;
          return (
            <g>
              <rect x={tx} y={ty} width={tw} height={th} rx="6" fill="hsl(var(--card))" stroke={accentColor} strokeOpacity="0.5" strokeWidth="1" />
              <text x={tx + tw / 2} y={ty + 13} textAnchor="middle" fontSize="9" fill="currentColor" fillOpacity="0.55" className="text-foreground">{month}</text>
              <text x={tx + tw / 2} y={ty + 27} textAnchor="middle" fontSize="11" fontWeight="700" fill={accentColor}>{fmt(tooltip.val)}</text>
            </g>
          );
        })()}
      </svg>

      {/* Bottom stat row */}
      <div className="flex justify-between text-[11px] pt-1 border-t border-border/30">
        <span className="text-muted-foreground">Lowest: <span className="font-mono text-foreground">{fmt(min)}</span></span>
        <span className="text-muted-foreground">Change: <span className={`font-mono font-bold ${vals[n - 1] >= vals[0] ? 'text-emerald-400' : 'text-rose-400'}`}>
          {vals[n - 1] >= vals[0] ? '+' : ''}{fmt(vals[n - 1] - vals[0])}
        </span></span>
        <span className="text-muted-foreground">Latest: <span className="font-mono font-bold" style={{ color: accentColor }}>{fmt(vals[n - 1])}</span></span>
      </div>
    </div>
  );
};

const CHART_COLORS: Record<string, string> = {
  gold: "#C9A13E",
  green: "#10b981",
  blue: "#3b82f6",
  purple: "#8b5cf6",
  rose: "#f43f5e",
};

function getProjectedFreedomAge(
  currentAge: number,
  netWorth: number,
  monthlySurplus: number,
  expectedReturn: number,
  freedomTarget: number
): number {
  if (netWorth >= freedomTarget) return currentAge;
  const r = expectedReturn / 100 / 12;
  const pmt = Math.max(0, monthlySurplus);
  const pv = Math.max(0, netWorth);
  if (r <= 0) {
    if (pmt <= 0) return 99;
    return Math.min(99, Math.round(currentAge + (freedomTarget - pv) / (pmt * 12)));
  }
  const pmtOverR = pmt / r;
  const numerator = freedomTarget + pmtOverR;
  const denominator = pv + pmtOverR;
  if (denominator <= 0 || numerator <= 0) return 99;
  const months = Math.log(numerator / denominator) / Math.log(1 + r);
  if (isNaN(months) || months < 0) return 99;
  return Math.min(99, Math.round(currentAge + months / 12));
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function stripCategoryEmoji(cat: string): string {
  const parts = cat.split(" ");
  while (parts.length > 1 && /[^\x00-\x7F]/.test(parts[parts.length - 1])) {
    parts.pop();
  }
  return parts.join(" ");
}

function getTxIcon(category: string, type: string): string {
  if (type === "transfer") return "💸";
  const cat = category.toLowerCase();
  if (cat.includes("food") || cat.includes("lunch") || cat.includes("dinner")) return "🍕";
  if (cat.includes("fuel") || cat.includes("petrol")) return "⛽";
  if (cat.includes("rent") || cat.includes("pg")) return "🏠";
  if (cat.includes("emi")) return "💳";
  if (cat.includes("health") || cat.includes("medical")) return "🏥";
  if (cat.includes("shopping")) return "🛍️";
  if (cat.includes("recharge") || cat.includes("mobile")) return "📱";
  if (cat.includes("gold")) return "🥇";
  if (cat.includes("salary")) return "💼";
  if (cat.includes("family")) return "👨‍👩‍👧";
  if (cat.includes("transfer")) return "💸";
  if (cat.includes("invest") || cat.includes("sip")) return "📈";
  if (cat.includes("chit")) return "🎲";
  return type === "income" ? "💰" : "🎯";
}

export const Dashboard: React.FC = () => {
  const { user, profile, accounts, transactions, investments, emis, themeColor, starredAccountIds, refreshData, storageMode, lastRefreshed, budgetLimits, fmt: formatIndianCurrency } = useApp();
  const [isAddTxOpen, setIsAddTxOpen] = useState(false);
  const [nwHistory, setNwHistory] = useState<NetWorthSnapshot[]>([]);

  useEffect(() => {
    if (!user?.id) return;
    localDb.networth_snapshots
      .where('user_id').equals(user.id)
      .sortBy('month')
      .then(snaps => setNwHistory(snaps.slice(-12)));
  }, [user?.id, lastRefreshed]);

  const accentColor = CHART_COLORS[themeColor] || CHART_COLORS.gold;

  // Core calculations
  const totalAccountBalance = accounts.reduce((s, a) => s + Number(a.balance), 0);
  const totalInvestmentValue = investments.reduce((s, i) => s + Number(i.current_value), 0);
  const familyDebt = profile ? Number(profile.family_debt) : 0;
  const netWorth = totalAccountBalance + totalInvestmentValue - familyDebt;
  const freedomTarget = profile ? Number(profile.freedom_target) : 9000000;
  const positiveNetWorth = Math.max(0, netWorth);
  const freedomProgress = freedomTarget > 0 ? Math.min(100, (positiveNetWorth / freedomTarget) * 100) : 0;
  const currentAge = profile ? Number(profile.age) : 23;
  const monthlySalary = profile ? Number(profile.monthly_salary) : 20000;
  const totalMonthlyEmi = emis.reduce((s, e) => s + Number(e.emi_amount), 0);
  const emiRatio = monthlySalary > 0 ? (totalMonthlyEmi / monthlySalary) * 100 : 0;

  // Monthly stats
  const now = new Date();
  const curYear = now.getFullYear();
  const curMonth = now.getMonth();
  const monthTxs = transactions.filter(t => {
    const d = new Date(t.date);
    return d.getFullYear() === curYear && d.getMonth() === curMonth;
  });
  const monthlyIncome = monthTxs.filter(t => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
  const monthlyExpense = monthTxs.filter(t => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
  const monthlyInvested = monthTxs.filter(t => {
    const cat = t.category || "";
    const note = (t.note || "").toLowerCase();
    return t.type === "expense" && (cat.includes("Gold Investment") || cat.includes("Investment") || note.includes("sip") || note.includes("investment"));
  }).reduce((s, t) => s + Number(t.amount), 0);

  const activeExpenses = monthTxs.filter(t => t.type === "expense" && !t.category.includes("EMI")).reduce((s, t) => s + Number(t.amount), 0);
  const monthlySurplus = monthlySalary - activeExpenses - totalMonthlyEmi;

  const projectedFreedomAge = getProjectedFreedomAge(currentAge, positiveNetWorth, Math.max(monthlySurplus, 500), 12, freedomTarget);
  const yearsToFreedom = projectedFreedomAge > currentAge ? projectedFreedomAge - currentAge : 0;
  const targetFreedomAge = profile?.target_freedom_age || 35;
  const onTrack = projectedFreedomAge <= targetFreedomAge;

  const emiStatus = emiRatio < 15
    ? { label: "Safe", color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20", fill: "#10b981" }
    : emiRatio <= 20
      ? { label: "Caution", color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20", fill: "#f59e0b" }
      : { label: "Danger", color: "text-rose-400", bg: "bg-rose-500/10 border-rose-500/20", fill: "#ef4444" };

  const starredAccounts = accounts.filter(a => starredAccountIds.includes(a.id));
  const recentTxs = [...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 6);
  const monthlySavingsRate = monthlyIncome > 0 ? ((monthlyIncome - monthlyExpense) / monthlyIncome) * 100 : 0;

  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshData();
    setRefreshing(false);
  };

  return (
    <div className="space-y-6 py-1">

      {/* ── Sync Status Banner ── */}
      <div className={`flex items-center justify-between px-3 py-2 rounded-xl border text-xs font-medium ${storageMode === 'cloud'
          ? 'bg-emerald-500/5 border-emerald-500/15 text-emerald-400'
          : 'bg-amber-500/5 border-amber-500/15 text-amber-400'
        }`}>
        <div className="flex items-center gap-2">
          {storageMode === 'cloud'
            ? <Cloud className="w-3.5 h-3.5" />
            : <HardDrive className="w-3.5 h-3.5" />}
          <span>{storageMode === 'cloud' ? 'Cloud Storage' : 'Local Storage'}</span>
          {lastRefreshed && (
            <span className="text-[10px] opacity-60">
              · Updated {lastRefreshed.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
          aria-label="Refresh data"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-in-up">
        <div>
          <p className="label-xs mb-1">{getGreeting()}</p>
          <h1 className="text-2xl md:text-[28px] font-bold text-foreground leading-tight m-0">
            {profile?.name || "Kalai"} <span className="text-muted-foreground font-normal text-xl">👋</span>
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {monthlySalary > 0 ? (
              <>
                Freedom in{" "}
                <span className="text-primary font-semibold">
                  {yearsToFreedom > 0 ? `${yearsToFreedom} years` : "reach"}
                </span>
                {" "}· Age {projectedFreedomAge}
              </>
            ) : (
              <span className="text-amber-400/80">Set up your profile to track freedom</span>
            )}
          </p>
        </div>

        <button
          onClick={() => setIsAddTxOpen(true)}
          className="btn-primary flex items-center gap-2 px-5 py-2.5 self-start sm:self-auto cursor-pointer min-h-[52px] min-w-[52px]"
        >
          <Plus className="w-4 h-4" strokeWidth={2.5} />
          Add Transaction
        </button>
      </div>

      {/* ── Daily Quote ── */}
      <div className="flex items-start gap-3 px-4 py-3 rounded-2xl bg-primary/5 border border-primary/10 animate-fade-in-up stagger-1">
        <Quote className="w-3.5 h-3.5 text-primary/50 shrink-0 mt-1" />
        <p className="text-primary/70 text-xs md:text-sm font-medium italic leading-relaxed m-0">
          {getDailyQuote()}
        </p>
      </div>

      {/* ── Hero Row: Net Worth + Freedom ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 animate-fade-in-up stagger-2">

        {/* Net Worth Card */}
        <div className="hero-card lg:col-span-2 p-6 flex flex-col justify-between">
          {/* Decorative background glow */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-3xl">
            <div
              className="absolute -top-8 -right-8 w-32 h-32 rounded-full opacity-20 blur-2xl"
              style={{ background: accentColor }}
            />
          </div>

          <div className="relative">
            <div className="flex items-center gap-2 mb-3">
              <div className="icon-box icon-box-primary w-8 h-8">
                <Wallet className="w-4 h-4" />
              </div>
              <span className="label-xs">Total Net Worth</span>
            </div>

            <div className={`hero-number mb-1 ${netWorth >= 0 ? "text-foreground" : "text-rose-400"}`}>
              {formatIndianCurrency(netWorth)}
            </div>

            {netWorth < 0 && (
              <div className="flex items-center gap-1.5 mt-2">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                <span className="text-xs text-rose-400 font-medium">Net negative — liability exceeds assets</span>
              </div>
            )}
          </div>

          <div className="relative mt-5 pt-4 border-t border-white/[0.07] grid grid-cols-2 gap-4">
            <div>
              <span className="label-xs block mb-1">Liquid Cash</span>
              <span className="font-mono text-base font-bold text-foreground">{formatIndianCurrency(totalAccountBalance)}</span>
            </div>
            <div>
              <span className="label-xs block mb-1">Invested</span>
              <span className="font-mono text-base font-bold text-emerald-400">{formatIndianCurrency(totalInvestmentValue)}</span>
            </div>
            {familyDebt > 0 && (
              <div className="col-span-2">
                <span className="label-xs block mb-1">Family Debt</span>
                <span className="font-mono text-base font-bold text-rose-400">−{formatIndianCurrency(familyDebt)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Freedom Progress */}
        <div className="aurora-card lg:col-span-3 p-6 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start gap-3 flex-wrap mb-6">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="icon-box icon-box-primary w-8 h-8">
                    <Flame className="w-4 h-4" />
                  </div>
                  <span className="label-xs">Freedom Journey</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="freedom-score text-4xl md:text-5xl">{freedomProgress.toFixed(1)}%</span>
                  <span className="text-xs text-muted-foreground mt-1">of {formatIndianCurrency(freedomTarget)}</span>
                </div>
              </div>

              <div className="text-right">
                <div className="label-xs mb-2">Target Age</div>
                {monthlySalary > 0 ? (
                  <>
                    <div className="flex items-center gap-1.5 justify-end">
                      <Sparkles className="w-4 h-4 text-primary" />
                      <span className="text-2xl font-bold text-primary font-mono">{projectedFreedomAge}</span>
                    </div>
                    <div className={`mt-1 text-xs font-semibold ${onTrack ? "text-emerald-400" : "text-amber-400"}`}>
                      {onTrack ? "✓ On track" : `${projectedFreedomAge - targetFreedomAge}y late`}
                    </div>
                  </>
                ) : (
                  <div className="text-xs text-muted-foreground mt-1">Set salary in Settings</div>
                )}
              </div>
            </div>

            {/* Progress bar */}
            <div className="space-y-2">
              <div className="progress-track">
                <div
                  className="progress-fill"
                  style={{ width: `${freedomProgress}%` }}
                  role="progressbar"
                  aria-valuenow={Math.round(freedomProgress)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                />
              </div>
              <div className="flex justify-between text-[9px] text-muted-foreground/40 font-mono px-0.5">
                <span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-border/40 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-xs text-muted-foreground">
            <span>
              Assumes monthly surplus{" "}
              <strong className="text-foreground font-mono">{formatIndianCurrency(Math.max(monthlySurplus, 0))}</strong>
              {" "}@ 12% p.a.
            </span>
            <Link to="/freedom" className="text-primary hover:underline flex items-center gap-1 shrink-0">
              Plan details <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </div>

      {/* ── Net Worth History ── */}
      {nwHistory.length >= 1 && (
        <div className="aurora-card p-5 animate-fade-in-up stagger-2">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="icon-box icon-box-violet w-8 h-8">
                <TrendingUp className="w-4 h-4" />
              </div>
              <span className="label-xs">Net Worth History</span>
            </div>
            <span className="text-[10px] text-muted-foreground">{nwHistory.length} month{nwHistory.length > 1 ? 's' : ''}</span>
          </div>

          {nwHistory.length === 1 ? (
            /* Single month — show as a stat */
            <div className="flex items-center justify-between px-2">
              <div>
                <p className="text-[10px] text-muted-foreground mb-1">{nwHistory[0].month}</p>
                <p className="text-2xl font-bold font-mono" style={{ color: accentColor }}>
                  {formatIndianCurrency(nwHistory[0].net_worth)}
                </p>
              </div>
              <p className="text-[10px] text-muted-foreground text-right">History builds<br />month by month</p>
            </div>
          ) : (
            <NwChart data={nwHistory} accentColor={accentColor} />
          )}
        </div>
      )}

      {/* ── Monthly Stats Grid ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-in-up stagger-3">

        {/* Income */}
        <div className="stat-card p-5">
          <div className="flex items-start justify-between mb-4">
            <span className="label-xs">Income</span>
            <div className="icon-box icon-box-success w-8 h-8">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <div className="kpi-number text-foreground">{formatIndianCurrency(monthlyIncome)}</div>
          <div className="mt-2 text-[11px] text-muted-foreground">This month</div>
          <div className="mt-3 progress-track">
            <div className="progress-fill" style={{ width: "100%", background: "#10b981", boxShadow: "none" }} />
          </div>
        </div>

        {/* Expenses */}
        <div className="stat-card p-5">
          <div className="flex items-start justify-between mb-4">
            <span className="label-xs">Expenses</span>
            <div className="icon-box icon-box-danger w-8 h-8">
              <ArrowDownRight className="w-4 h-4" />
            </div>
          </div>
          <div className="kpi-number text-foreground">{formatIndianCurrency(monthlyExpense)}</div>
          <div className="mt-2 text-[11px] text-muted-foreground">This month</div>
          <div className="mt-3 progress-track">
            <div
              className="progress-fill"
              style={{
                width: monthlyIncome > 0 ? `${Math.min(100, (monthlyExpense / monthlyIncome) * 100)}%` : "0%",
                background: "#ef4444",
                boxShadow: "none"
              }}
            />
          </div>
        </div>

        {/* Invested */}
        <div className="stat-card p-5">
          <div className="flex items-start justify-between mb-4">
            <span className="label-xs">Invested</span>
            <div className="icon-box icon-box-violet w-8 h-8">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="kpi-number text-foreground">{formatIndianCurrency(totalInvestmentValue)}</div>
          <div className="mt-2 text-[11px] text-muted-foreground">Total portfolio value</div>
          <div className="mt-3 progress-track">
            <div
              className="progress-fill"
              style={{
                width: totalInvestmentValue > 0 ? "100%" : "0%",
                background: "#8b5cf6",
                boxShadow: "none"
              }}
            />
          </div>
        </div>

        {/* EMI Health */}
        <div className="stat-card p-5">
          <div className="flex items-start justify-between mb-4">
            <span className="label-xs">EMI Ratio</span>
            <div className={`icon-box w-8 h-8 ${emiStatus.bg}`} style={{ color: emiStatus.fill }}>
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div className="kpi-number text-foreground">{monthlySalary > 0 ? `${emiRatio.toFixed(1)}%` : "—"}</div>
          <div className={`mt-2 text-[11px] font-semibold ${monthlySalary > 0 ? emiStatus.color : "text-amber-400"}`}>{monthlySalary > 0 ? `${emiStatus.label} · ≤15% ideal` : "Set salary to calculate"}</div>
          <div className="mt-3 progress-track">
            <div
              className="progress-fill"
              style={{ width: `${Math.min(100, emiRatio)}%`, background: emiStatus.fill, boxShadow: "none" }}
            />
          </div>
        </div>
      </div>

      {/* ── Budget Health summary ── */}
      {Object.keys(budgetLimits).length > 0 && (() => {
        const health = Object.entries(budgetLimits).map(([cat, limit]) => {
          const spent = monthTxs
            .filter(t => t.type === 'expense' && t.category === cat && !t.transfer_to_account_id)
            .reduce((s, t) => s + Number(t.amount), 0);
          const pct = Number(limit) > 0 ? (spent / Number(limit)) * 100 : 0;
          return pct > 100 ? 'over' : pct >= 80 ? 'warning' : 'ok';
        });
        const overCount = health.filter(s => s === 'over').length;
        const warnCount = health.filter(s => s === 'warning').length;
        const okCount = health.filter(s => s === 'ok').length;
        return (
          <Link
            to="/budgets"
            className="aurora-card p-5 flex items-center gap-4 animate-fade-in-up hover:border-primary/30 transition-colors"
          >
            <div className={`icon-box w-10 h-10 ${overCount > 0 ? 'icon-box-danger' : warnCount > 0 ? 'icon-box-warning' : 'icon-box-primary'}`}>
              <PiggyBank className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-foreground">Budget Health</p>
              <p className="text-xs text-muted-foreground">
                {overCount > 0 && <span className="text-rose-400 font-semibold">{overCount} over budget</span>}
                {overCount > 0 && (warnCount > 0 || okCount > 0) && ' · '}
                {warnCount > 0 && <span className="text-amber-400 font-semibold">{warnCount} near limit</span>}
                {warnCount > 0 && okCount > 0 && ' · '}
                {okCount > 0 && <span className="text-emerald-400 font-semibold">{okCount} on track</span>}
                {overCount === 0 && warnCount === 0 && okCount === 0 && 'No categories tracked yet'}
              </p>
            </div>
            {overCount === 0 && warnCount === 0 ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : (
              <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
            )}
          </Link>
        );
      })()}

      {/* ── Budget Alerts ── */}
      {Object.keys(budgetLimits).length > 0 && (() => {
        const alerts = Object.entries(budgetLimits).map(([cat, limit]) => {
          const spent = monthTxs.filter(t => t.type === 'expense' && t.category === cat && !t.transfer_to_account_id).reduce((s, t) => s + Number(t.amount), 0);
          const pct = limit > 0 ? (spent / limit) * 100 : 0;
          return { cat, limit, spent, pct };
        }).filter(a => a.pct > 0);
        if (!alerts.length) return null;
        return (
          <div className="aurora-card p-5 animate-fade-in-up">
            <div className="flex items-center gap-2 mb-4">
              <div className="icon-box icon-box-warning w-8 h-8"><AlertTriangle className="w-4 h-4" /></div>
              <span className="label-xs">Budget Tracker</span>
            </div>
            <div className="space-y-3">
              {alerts.map(({ cat, limit, spent, pct }) => (
                <div key={cat}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-foreground font-medium">{cat}</span>
                    <span className={pct >= 100 ? 'text-rose-400 font-bold' : pct >= 80 ? 'text-amber-400' : 'text-muted-foreground'}>
                      {formatIndianCurrency(spent)} / {formatIndianCurrency(limit)}
                      {pct >= 100 && ' ⚠ Over!'}
                    </span>
                  </div>
                  <div className="progress-track">
                    <div className="progress-fill" style={{
                      width: `${Math.min(100, pct)}%`,
                      background: pct >= 100 ? '#ef4444' : pct >= 80 ? '#f59e0b' : accentColor,
                      boxShadow: 'none'
                    }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* ── Savings Rate + Accounts Row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 animate-fade-in-up stagger-4">

        {/* Savings Rate Gauge */}
        <div className="aurora-card p-6">
          <div className="flex items-center gap-2 mb-5">
            <div className="icon-box icon-box-primary w-8 h-8">
              <Target className="w-4 h-4" />
            </div>
            <span className="label-xs">Savings Rate</span>
          </div>

          {/* Simple circular-ish visual */}
          <div className="flex items-end gap-4">
            <div>
              <div className="text-3xl font-bold font-mono" style={{ color: accentColor }}>
                {monthlySavingsRate > 0 ? monthlySavingsRate.toFixed(0) : 0}%
              </div>
              <div className="text-xs text-muted-foreground mt-1">of monthly income</div>
            </div>
            <div className="flex-1 space-y-1.5">
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>Income</span>
                <span className="font-mono">{formatIndianCurrency(monthlyIncome)}</span>
              </div>
              <div className="progress-track h-1.5">
                <div className="progress-fill h-full" style={{ width: "100%", background: "#10b981", boxShadow: "none" }} />
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>Spent</span>
                <span className="font-mono text-rose-400">{formatIndianCurrency(monthlyExpense)}</span>
              </div>
              <div className="progress-track h-1.5">
                <div
                  className="progress-fill h-full"
                  style={{
                    width: monthlyIncome > 0 ? `${Math.min(100, (monthlyExpense / monthlyIncome) * 100)}%` : "0%",
                    background: "#ef4444", boxShadow: "none"
                  }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>Invested</span>
                <span className="font-mono text-violet-400">{formatIndianCurrency(monthlyInvested)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Starred Accounts / Quick Stats */}
        <div className="lg:col-span-2 aurora-card p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <div className="icon-box icon-box-warning w-8 h-8">
                <Star className="w-4 h-4" />
              </div>
              <span className="label-xs">Starred Accounts</span>
            </div>
            <Link to="/accounts" className="text-xs text-primary hover:underline flex items-center gap-1">
              All accounts <ChevronRight className="w-3 h-3" />
            </Link>
          </div>

          {starredAccounts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm space-y-2">
              <Star className="w-8 h-8 mx-auto opacity-20" />
              <p className="text-sm font-medium text-foreground/60">No starred accounts</p>
              <p className="text-xs text-muted-foreground">
                {accounts.length === 0
                  ? "Add accounts first, then star them to pin here"
                  : "Go to Accounts and tap ☆ to pin them here"}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {starredAccounts.slice(0, 4).map(acc => (
                <div key={acc.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-primary/20 transition-colors">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold shrink-0"
                    style={{ background: `${accentColor}20`, color: accentColor, border: `1px solid ${accentColor}30` }}
                  >
                    {acc.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-foreground truncate">{acc.name}</div>
                    <div className="text-[10px] text-muted-foreground capitalize">{acc.type || "Account"}</div>
                  </div>
                  <div className="text-right">
                    <div className={`text-sm font-bold font-mono ${Number(acc.balance) >= 0 ? "text-foreground" : "text-rose-400"}`}>
                      {formatIndianCurrency(Number(acc.balance))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Recent Transactions ── */}
      <div className="aurora-card p-6 animate-fade-in-up stagger-5">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <div className="icon-box icon-box-cyan w-8 h-8">
              <BarChart3 className="w-4 h-4" />
            </div>
            <span className="label-xs">Recent Transactions</span>
          </div>
          <Link to="/transactions" className="text-xs text-primary hover:underline flex items-center gap-1">
            View all <ChevronRight className="w-3 h-3" />
          </Link>
        </div>

        {recentTxs.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">
            <Zap className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No transactions yet</p>
            <button
              onClick={() => setIsAddTxOpen(true)}
              className="mt-3 text-primary text-xs hover:underline cursor-pointer"
            >
              Add your first transaction
            </button>
          </div>
        ) : (
          <div className="space-y-1">
            {recentTxs.map((tx, i) => {
              const isIncome = tx.type === "income";
              const isTransfer = tx.type === "transfer";
              const account = accounts.find(a => a.id === tx.account_id);
              const displayCat = stripCategoryEmoji(tx.category);

              return (
                <div key={tx.id} className="tx-row group">
                  <div className="cat-icon text-lg" style={{ background: `${accentColor}12`, border: `1px solid ${accentColor}20` }}>
                    {getTxIcon(tx.category, tx.type)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-foreground truncate">
                        {tx.note || displayCat}
                      </span>
                      {tx.is_recurring && (
                        <span className="badge badge-primary text-[9px] py-0.5">SIP</span>
                      )}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1.5">
                      <span>{displayCat}</span>
                      {account && (
                        <>
                          <span>·</span>
                          <span>{account.name}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className={`text-sm font-bold font-mono ${isIncome ? "text-emerald-400" : isTransfer ? "text-amber-400" : "text-rose-400"}`}>
                      {isIncome ? "+" : isTransfer ? "" : "−"}{formatIndianCurrency(Number(tx.amount))}
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      {new Date(tx.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                    </div>
                  </div>

                  <div className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    {isIncome
                      ? <ArrowUpRight className="w-4 h-4 text-emerald-400" />
                      : isTransfer
                        ? <ArrowRightLeft className="w-4 h-4 text-amber-400" />
                        : <ArrowDownRight className="w-4 h-4 text-rose-400" />
                    }
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Monthly Budget Tracker ── */}
      {(() => {
        const budgetEntries = Object.entries(budgetLimits).filter(([, limit]) => Number(limit) > 0);
        return (
          <div className="glass-card p-6 animate-fade-in-up">
            <div className="flex items-center gap-2 mb-5">
              <div className="icon-box icon-box-primary w-8 h-8">
                <BarChart3 className="w-4 h-4" />
              </div>
              <span className="label-xs">Monthly Budget</span>
            </div>
            {budgetEntries.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">
                Set budgets in Settings → Budget Limits
              </p>
            ) : (
              <div className="space-y-4">
                {budgetEntries.map(([cat, limit]) => {
                  const spent = monthTxs.filter(t => t.type === "expense" && t.category === cat).reduce((s, t) => s + Number(t.amount), 0);
                  const pct = Number(limit) > 0 ? Math.min(100, (spent / Number(limit)) * 100) : 0;
                  const barColor = pct > 90 ? "#ef4444" : pct >= 70 ? "#f59e0b" : "#10b981";
                  const pctColor = pct > 90 ? "text-rose-400" : pct >= 70 ? "text-amber-400" : "text-emerald-400";
                  return (
                    <div key={cat}>
                      <div className="flex items-center justify-between text-xs mb-1.5 gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-base leading-none">{getTxIcon(cat, "expense")}</span>
                          <span className="font-medium text-foreground truncate">{stripCategoryEmoji(cat)}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-mono text-muted-foreground">
                            {formatIndianCurrency(spent)} / {formatIndianCurrency(Number(limit))}
                          </span>
                          <span className={`font-bold font-mono w-9 text-right ${pctColor}`}>{pct.toFixed(0)}%</span>
                        </div>
                      </div>
                      <div className="progress-track">
                        <div
                          className="progress-fill"
                          style={{ width: `${pct}%`, background: barColor, boxShadow: "none" }}
                          role="progressbar"
                          aria-valuenow={Math.round(pct)}
                          aria-valuemin={0}
                          aria-valuemax={100}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      {/* Add Transaction Modal */}
      <Modal isOpen={isAddTxOpen} onClose={() => setIsAddTxOpen(false)} title="New Transaction">
        <TransactionForm onClose={() => { setIsAddTxOpen(false); refreshData(); }} />
      </Modal>
    </div>
  );
};
