import React, { useState } from "react";
import { useApp } from "../context/AppContext";
import { formatIndianNumberOnly } from "../lib/utils";
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  Area,
  AreaChart,
} from "recharts";
import {
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Coins,
  TrendingUp,
  TrendingDown,
  PiggyBank,
} from "lucide-react";

const CHART_COLORS: Record<string, string> = {
  gold:   "#C9A13E",
  green:  "#10b981",
  blue:   "#3b82f6",
  purple: "#8b5cf6",
  rose:   "#f43f5e",
};

/* ── Custom Chart Tooltip ── */
const CustomTooltip = ({ active, payload, label, theme }: any) => {
  if (!active || !payload?.length) return null;

  const isDark = !document.documentElement.classList.contains("light");

  return (
    <div
      style={{
        background: isDark ? "rgba(10, 12, 28, 0.97)" : "rgba(255,255,255,0.97)",
        border: isDark ? "1px solid rgba(255,255,255,0.10)" : "1px solid rgba(0,0,0,0.10)",
        borderRadius: "16px",
        padding: "14px 18px",
        backdropFilter: "blur(24px)",
        boxShadow: isDark
          ? "0 24px 48px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05)"
          : "0 12px 32px rgba(0,0,0,0.12)",
        fontFamily: "IBM Plex Sans, sans-serif",
        minWidth: "160px",
      }}
    >
      <p
        style={{
          color: isDark ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.45)",
          fontSize: "10px",
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          marginBottom: "10px",
          margin: "0 0 10px 0",
        }}
      >
        {label}
      </p>
      {payload.map((entry: any, i: number) => (
        <div
          key={i}
          style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: i < payload.length - 1 ? "6px" : 0 }}
        >
          <div
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              background: entry.color,
              flexShrink: 0,
              boxShadow: `0 0 8px ${entry.color}`,
            }}
          />
          <span style={{ color: isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.5)", fontSize: "12px", flex: 1 }}>
            {entry.name}
          </span>
          <span style={{ color: isDark ? "#fff" : "#0f172a", fontSize: "13px", fontWeight: 700, fontFamily: "IBM Plex Mono, monospace" }}>
            {formatIndianCurrency(entry.value)}
          </span>
        </div>
      ))}
    </div>
  );
};

const CategoryTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const isDark = !document.documentElement.classList.contains("light");
  return (
    <div
      style={{
        background: isDark ? "rgba(10,12,28,0.97)" : "rgba(255,255,255,0.97)",
        border: isDark ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(0,0,0,0.1)",
        borderRadius: "14px",
        padding: "12px 16px",
        backdropFilter: "blur(24px)",
        boxShadow: isDark ? "0 20px 40px rgba(0,0,0,0.5)" : "0 12px 32px rgba(0,0,0,0.12)",
        fontFamily: "IBM Plex Sans, sans-serif",
      }}
    >
      <p style={{ color: isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.5)", fontSize: "11px", margin: "0 0 6px 0", fontWeight: 600 }}>
        {label}
      </p>
      <p style={{ color: isDark ? "#fff" : "#0f172a", fontSize: "14px", fontWeight: 700, fontFamily: "IBM Plex Mono, monospace", margin: 0 }}>
        {formatIndianCurrency(payload[0]?.value)}
      </p>
    </div>
  );
};

export const Reports: React.FC = () => {
  const { transactions, accounts, investments, profile, themeColor, fmt: formatIndianCurrency } = useApp();
  const accentColor = CHART_COLORS[themeColor] || CHART_COLORS.gold;

  const [selectedMonthStr, setSelectedMonthStr] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  const getMonthOptions = () => {
    const options = [];
    const now = new Date();
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
      options.push({ val, label });
    }
    return options;
  };

  const selectedYear  = Number(selectedMonthStr.split("-")[0]);
  const selectedMonth = Number(selectedMonthStr.split("-")[1]) - 1;

  const monthlyTxs = transactions.filter(t => {
    const d = new Date(t.date);
    return d.getFullYear() === selectedYear && d.getMonth() === selectedMonth;
  });

  const monthlyIncome    = monthlyTxs.filter(t => t.type === "income").reduce((sum, t) => sum + Number(t.amount), 0);
  const monthlyExpense   = monthlyTxs.filter(t => t.type === "expense").reduce((sum, t) => sum + Number(t.amount), 0);
  const monthlyInvested  = monthlyTxs.filter(t => {
    const isInvCat  = t.category.includes("Gold Investment") || t.category.includes("Investment");
    const isInvNote = t.note?.toLowerCase().includes("sip") || t.note?.toLowerCase().includes("investment");
    return t.type === "expense" && (isInvCat || isInvNote);
  }).reduce((sum, t) => sum + Number(t.amount), 0);
  const netSaved = monthlyIncome - monthlyExpense;

  // Category breakdown
  const getCategoryBreakdown = () => {
    const expenseTxs = monthlyTxs.filter(t => t.type === "expense");
    const categoriesMap: Record<string, number> = {};
    expenseTxs.forEach(tx => {
      const cat = tx.category.replace(/\s[\u{1F300}-\u{1FFFF}]|[\u{1F000}-\u{1FFFF}]|\s[^\x00-\x7F]+$/gu, "").trim();
      categoriesMap[cat] = (categoriesMap[cat] || 0) + Number(tx.amount);
    });
    return Object.entries(categoriesMap)
      .map(([category, amount]) => ({ category, amount: Math.round(amount) }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 8);
  };
  const categoryData = getCategoryBreakdown();

  // 6-month trend
  const compileSixMonthData = () => {
    const data = [];
    const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d  = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const m  = d.getMonth();
      const y  = d.getFullYear();
      const txs = transactions.filter(t => {
        const txDate = new Date(t.date);
        return txDate.getFullYear() === y && txDate.getMonth() === m;
      });
      let inc = txs.filter(t => t.type === "income").reduce((sum, t) => sum + Number(t.amount), 0);
      let exp = txs.filter(t => t.type === "expense").reduce((sum, t) => sum + Number(t.amount), 0);
      let inv = txs.filter(t => {
        const isInvCat  = t.category.includes("Gold Investment") || t.category.includes("Investment");
        const isInvNote = t.note?.toLowerCase().includes("sip") || t.note?.toLowerCase().includes("investment");
        return t.type === "expense" && (isInvCat || isInvNote);
      }).reduce((sum, t) => sum + Number(t.amount), 0);

      data.push({ name: monthNames[m], Income: Math.round(inc), Expense: Math.round(exp), Investment: Math.round(inv) });
    }
    return data;
  };
  const sixMonthData = compileSixMonthData();

  // Net worth timeline
  const totalAccountBalance = accounts.reduce((sum, a) => sum + Number(a.balance), 0);
  const totalInvestmentValue = investments.reduce((sum, i) => sum + Number(i.current_value), 0);
  const familyDebt = profile ? Number(profile.family_debt) : 0;
  const currentNetWorth = totalAccountBalance + totalInvestmentValue - familyDebt;

  const netWorthData = (() => {
    const data = [];
    const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const now = new Date();
    // Build running net worth month by month from actual transactions
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const m = d.getMonth();
      const y = d.getFullYear();
      // Sum all transactions up to end of this month
      const cutoff = new Date(y, m + 1, 0); // last day of month
      const txsUpTo = transactions.filter(t => new Date(t.date) <= cutoff);
      const incomeUpTo = txsUpTo.filter(t => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
      const expenseUpTo = txsUpTo.filter(t => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
      const runningCash = incomeUpTo - expenseUpTo;
      const invValue = i === 0 ? totalInvestmentValue : 0; // only current month has actual investment value
      const value = runningCash + invValue - familyDebt;
      data.push({ name: monthNames[m], "Net Worth": Math.round(value) });
    }
    return data;
  })();

  const biggestSingleExpenses = monthlyTxs
    .filter(t => t.type === "expense")
    .sort((a, b) => Number(b.amount) - Number(a.amount))
    .slice(0, 5);

  const axisStyle = { fill: "#6b7280", fontSize: 11, fontFamily: "IBM Plex Sans, sans-serif" };

  return (
    <div className="space-y-6 py-1">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-in-up">
        <div>
          <p className="label-xs mb-1">Analytics</p>
          <h2 className="text-2xl md:text-[28px] font-bold text-foreground m-0">Financial Reports</h2>
          <p className="text-muted-foreground text-sm mt-0.5">Audit your cash flow and track wealth growth</p>
        </div>

        <div className="aurora-card flex items-center gap-2.5 px-4 py-2.5 cursor-pointer">
          <Calendar className="w-4 h-4 text-primary" />
          <select
            value={selectedMonthStr}
            onChange={e => setSelectedMonthStr(e.target.value)}
            className="bg-transparent text-foreground text-sm font-semibold focus:outline-none cursor-pointer"
          >
            {getMonthOptions().map(opt => (
              <option key={opt.val} value={opt.val}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-in-up stagger-1">
        <div className="stat-card p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="label-xs">Income</span>
            <div className="icon-box icon-box-success w-8 h-8">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <div className="kpi-number text-foreground">{formatIndianCurrency(monthlyIncome)}</div>
        </div>
        <div className="stat-card p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="label-xs">Expenses</span>
            <div className="icon-box icon-box-danger w-8 h-8">
              <ArrowDownRight className="w-4 h-4" />
            </div>
          </div>
          <div className="kpi-number text-foreground">{formatIndianCurrency(monthlyExpense)}</div>
        </div>
        <div className="stat-card p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="label-xs">Invested</span>
            <div className="icon-box icon-box-cyan w-8 h-8">
              <Coins className="w-4 h-4" />
            </div>
          </div>
          <div className="kpi-number text-foreground">{formatIndianCurrency(monthlyInvested)}</div>
        </div>
        <div className="stat-card p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="label-xs">Net Saved</span>
            <div className={`icon-box w-8 h-8 ${netSaved >= 0 ? "icon-box-success" : "icon-box-danger"}`}>
              {netSaved >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            </div>
          </div>
          <div className={`kpi-number ${netSaved >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
            {netSaved >= 0 ? "+" : ""}{formatIndianCurrency(netSaved)}
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in-up stagger-2">

        {/* 6-Month Trend Bar Chart */}
        <div className="aurora-card p-6 space-y-4">
          <h4 className="text-sm font-bold text-foreground m-0">6-Month Cash Flow</h4>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sixMonthData} barGap={4} barCategoryGap="28%">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,120,120,0.06)" vertical={false} />
                <XAxis dataKey="name" tick={axisStyle} tickLine={false} axisLine={false} />
                <YAxis tick={axisStyle} tickLine={false} axisLine={false} tickFormatter={val => `₹${formatIndianNumberOnly(val)}`} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: "11px", paddingTop: "12px", fontFamily: "IBM Plex Sans, sans-serif" }} />
                <Bar dataKey="Income"     fill="#10b981" radius={[6,6,0,0]} />
                <Bar dataKey="Expense"    fill="#ef4444" radius={[6,6,0,0]} />
                <Bar dataKey="Investment" fill="#8b5cf6" radius={[6,6,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category Spend */}
        <div className="aurora-card p-6 space-y-4">
          <h4 className="text-sm font-bold text-foreground m-0">Spending by Category</h4>
          <div className="h-64 w-full">
            {categoryData.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground text-sm gap-2">
                <PiggyBank className="w-8 h-8 opacity-30" />
                <span>No expenses this month</span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryData} layout="vertical" barCategoryGap="18%">
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,120,120,0.06)" horizontal={false} />
                  <XAxis type="number" tick={axisStyle} tickLine={false} axisLine={false} tickFormatter={val => `₹${formatIndianNumberOnly(val)}`} />
                  <YAxis dataKey="category" type="category" tick={axisStyle} tickLine={false} axisLine={false} width={72} />
                  <Tooltip content={<CategoryTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                  <Bar dataKey="amount" radius={[0,6,6,0]}>
                    {categoryData.map((_, index) => {
                      const colors = [accentColor, "#8b5cf6", "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#06b6d4", "#ec4899"];
                      return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Net Worth Timeline */}
        <div className="aurora-card p-6 space-y-4">
          <h4 className="text-sm font-bold text-foreground m-0">Net Worth Growth</h4>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={netWorthData}>
                <defs>
                  <linearGradient id="netWorthGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={accentColor} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={accentColor} stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,120,120,0.06)" vertical={false} />
                <XAxis dataKey="name" tick={axisStyle} tickLine={false} axisLine={false} />
                <YAxis tick={axisStyle} tickLine={false} axisLine={false} tickFormatter={val => `₹${formatIndianNumberOnly(val)}`} />
                <Tooltip content={<CustomTooltip />} cursor={{ stroke: accentColor, strokeWidth: 1, strokeDasharray: "4 4" }} />
                <Area
                  type="monotone"
                  dataKey="Net Worth"
                  stroke={accentColor}
                  strokeWidth={2.5}
                  fill="url(#netWorthGrad)"
                  dot={false}
                  activeDot={{ r: 6, fill: accentColor, stroke: "rgba(255,255,255,0.3)", strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Biggest Single Outflows */}
        <div className="aurora-card p-6 space-y-4">
          <h4 className="text-sm font-bold text-foreground m-0">Biggest Outflows This Month</h4>
          {biggestSingleExpenses.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground text-sm">
              <PiggyBank className="w-8 h-8 mx-auto mb-2 opacity-30" />
              No expenses recorded
            </div>
          ) : (
            <div className="space-y-3">
              {biggestSingleExpenses.map((tx, idx) => {
                const pct = biggestSingleExpenses[0]
                  ? (Number(tx.amount) / Number(biggestSingleExpenses[0].amount)) * 100
                  : 0;
                const rankColors = [accentColor, "#8b5cf6", "#3b82f6", "#f59e0b", "#10b981"];
                const color = rankColors[idx] || "#6b7280";
                const cleanCat = tx.category.replace(/\s[\u{1F300}-\u{1FFFF}]|[\u{1F000}-\u{1FFFF}]|\s[^\x00-\x7F]+$/gu, "").trim();

                return (
                  <div key={tx.id} className="group">
                    <div className="flex items-center gap-3 mb-1.5">
                      <span
                        className="text-xs font-black w-5 h-5 rounded-full flex items-center justify-center text-[10px] shrink-0"
                        style={{ background: `${color}20`, color }}
                      >
                        {idx + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-semibold text-foreground truncate block">
                          {tx.note || cleanCat}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {cleanCat} · {new Date(tx.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                        </span>
                      </div>
                      <span className="text-sm font-bold font-mono text-rose-400 shrink-0">
                        -{formatIndianCurrency(tx.amount)}
                      </span>
                    </div>
                    <div className="progress-track ml-8">
                      <div
                        className="progress-fill"
                        style={{ width: `${pct}%`, background: color, boxShadow: `0 0 8px ${color}60` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
