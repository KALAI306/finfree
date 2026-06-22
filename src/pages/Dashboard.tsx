import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { formatIndianCurrency, formatIndianNumberOnly } from "../lib/utils";
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
} from "lucide-react";
import { Modal } from "../components/Modal";
import { TransactionForm } from "./Transactions.tsx";

const CHART_COLORS: Record<string, string> = {
  gold:   "#C9A13E",
  green:  "#10b981",
  blue:   "#3b82f6",
  purple: "#8b5cf6",
  rose:   "#f43f5e",
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
  const { profile, accounts, transactions, investments, emis, themeColor, starredAccountIds, refreshData } = useApp();
  const [isAddTxOpen, setIsAddTxOpen] = useState(false);

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
  const monthlyIncome   = monthTxs.filter(t => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
  const monthlyExpense  = monthTxs.filter(t => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
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
  const monthlySavingsRate = monthlySalary > 0 ? ((monthlySalary - monthlyExpense) / monthlySalary) * 100 : 0;

  return (
    <div className="space-y-6 py-1">

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
          className="btn-primary flex items-center gap-2 px-5 py-2.5 self-start sm:self-auto cursor-pointer"
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
          <div className="kpi-number text-foreground">{formatIndianCurrency(monthlyInvested)}</div>
          <div className="mt-2 text-[11px] text-muted-foreground">This month</div>
          <div className="mt-3 progress-track">
            <div
              className="progress-fill"
              style={{
                width: monthlyIncome > 0 ? `${Math.min(100, (monthlyInvested / monthlyIncome) * 100)}%` : "0%",
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
          <div className="kpi-number text-foreground">{emiRatio.toFixed(1)}%</div>
          <div className={`mt-2 text-[11px] font-semibold ${emiStatus.color}`}>{emiStatus.label} · ≤15% ideal</div>
          <div className="mt-3 progress-track">
            <div
              className="progress-fill"
              style={{ width: `${Math.min(100, emiRatio)}%`, background: emiStatus.fill, boxShadow: "none" }}
            />
          </div>
        </div>
      </div>

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
              <div className="text-xs text-muted-foreground mt-1">of monthly salary</div>
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

      {/* Add Transaction Modal */}
      <Modal isOpen={isAddTxOpen} onClose={() => setIsAddTxOpen(false)} title="New Transaction">
        <TransactionForm onClose={() => { setIsAddTxOpen(false); refreshData(); }} />
      </Modal>
    </div>
  );
};
