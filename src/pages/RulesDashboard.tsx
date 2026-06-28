import React, { useState, useEffect } from "react";
import { useApp } from "../context/AppContext";
import { formatIndianNumberOnly } from "../lib/utils";
import { Link } from "react-router-dom";
import {
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  Target,
  Calendar,
  ArrowUpDown,
  Plus,
  Pencil,
  Trash2,
  X,
  Check,
} from "lucide-react";

interface CustomRule {
  id: string;
  name: string;
  category: string;
  limitAmount: number;
  period: "monthly";
}

interface RuleThresholds {
  emiLimit: number;
  investmentTarget: number;
  needsLimit: number;
  emergencyTarget: number;
  savingsTarget: number;
}

const DEFAULT_THRESHOLDS: RuleThresholds = {
  emiLimit: 15,
  investmentTarget: 20,
  needsLimit: 50,
  emergencyTarget: 50000,
  savingsTarget: 30,
};

export const RulesDashboard: React.FC = () => {
  const { profile, emis, investments, goals, transactions, user, fmt: formatIndianCurrency } = useApp();
  const [expandedRule, setExpandedRule] = useState<string | null>(null);

  // Persisted thresholds per user
  const [thresholds, setThresholds] = useState<RuleThresholds>(DEFAULT_THRESHOLDS);
  const [editingThreshold, setEditingThreshold] = useState<string | null>(null);
  const [thresholdDraft, setThresholdDraft] = useState<string>("");

  // Custom rules
  const [customRules, setCustomRules] = useState<CustomRule[]>([]);
  const [showAddCustom, setShowAddCustom] = useState(false);
  const [editingCustom, setEditingCustom] = useState<CustomRule | null>(null);
  const [customDraft, setCustomDraft] = useState<Omit<CustomRule, "id">>({ name: "", category: "", limitAmount: 0, period: "monthly" });

  const uid = user?.id;

  useEffect(() => {
    if (!uid) return;
    try {
      const t = localStorage.getItem(`finfree_rule_thresholds_${uid}`);
      if (t) setThresholds({ ...DEFAULT_THRESHOLDS, ...JSON.parse(t) });
    } catch {}
    try {
      const c = localStorage.getItem(`finfree_custom_rules_${uid}`);
      if (c) setCustomRules(JSON.parse(c));
    } catch {}
  }, [uid]);

  const saveThresholds = (updated: RuleThresholds) => {
    setThresholds(updated);
    if (uid) localStorage.setItem(`finfree_rule_thresholds_${uid}`, JSON.stringify(updated));
  };

  const saveCustomRules = (rules: CustomRule[]) => {
    setCustomRules(rules);
    if (uid) localStorage.setItem(`finfree_custom_rules_${uid}`, JSON.stringify(rules));
  };

  const toggleExpand = (id: string) =>
    setExpandedRule(expandedRule === id ? null : id);

  // --- Calculations ---
  const salary = profile ? Number(profile.monthly_salary) : 0;
  const totalEmi = emis.reduce((s, e) => s + Number(e.emi_amount), 0);
  const emiPercent = salary > 0 ? (totalEmi / salary) * 100 : 0;

  const now = new Date();
  const currentMonthTxs = transactions.filter(t => {
    const d = new Date(t.date);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  });

  const monthlyInvested = currentMonthTxs
    .filter(t => {
      const isInvCat = t.category.includes("Gold Investment") || t.category.includes("Investment");
      const isInvNote = t.note?.toLowerCase().includes("sip") || t.note?.toLowerCase().includes("investment");
      return t.type === "expense" && (isInvCat || isInvNote);
    })
    .reduce((s, t) => s + Number(t.amount), 0);
  const investmentPercent = salary > 0 ? (monthlyInvested / salary) * 100 : 0;

  const needsExpense = currentMonthTxs
    .filter(t => t.type === "expense" && (
      t.category.includes("Rent") || t.category.includes("Food") ||
      t.category.includes("Fuel") || t.category.includes("Recharges") ||
      t.category.includes("EMI") || t.category.includes("Healthcare") ||
      t.category.includes("Daily Workers")
    ))
    .reduce((s, t) => s + Number(t.amount), 0);
  const needsPercent = salary > 0 ? (needsExpense / salary) * 100 : 0;

  const efGoal = goals.find(g => g.name.toLowerCase().includes("emergency"));
  const efCurrent = efGoal ? Number(efGoal.current_amount) : 0;
  const efTarget = thresholds.emergencyTarget;
  const efProgressPercent = efTarget > 0 ? (efCurrent / efTarget) * 100 : 0;

  const monthlyIncome = currentMonthTxs.filter(t => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
  const totalExpense = currentMonthTxs.filter(t => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
  const netSaved = Math.max(0, monthlyIncome - totalExpense);
  const savingsRate = monthlyIncome > 0 ? (netSaved / monthlyIncome) * 100 : 0;

  // --- Built-in rules config ---
  const builtinRules = [
    {
      id: "emi",
      name: "EMI Debt Threshold",
      formula: "Total Monthly EMIs ÷ Monthly Salary",
      currentLabel: `${emiPercent.toFixed(1)}% of salary (${formatIndianCurrency(totalEmi)}/mo)`,
      targetLabel: `Under ${thresholds.emiLimit}% of salary`,
      status: (emiPercent < thresholds.emiLimit ? "green" : emiPercent <= thresholds.emiLimit * 1.33 ? "yellow" : "red") as "green" | "yellow" | "red",
      tip: emiPercent > thresholds.emiLimit
        ? `Reduce EMI by ₹${formatIndianNumberOnly(Math.round(totalEmi - salary * (thresholds.emiLimit / 100)))} to reach the safe ${thresholds.emiLimit}% threshold.`
        : "Your EMI ratio is within the healthy zone! Maintain low leverage.",
      actionText: "Manage Loans",
      actionPath: "/emi",
      actionIcon: <Calendar className="w-4 h-4" />,
      thresholdKey: "emiLimit" as keyof RuleThresholds,
      thresholdLabel: "Max EMI % of salary",
      thresholdSuffix: "%",
    },
    {
      id: "investment",
      name: "Investment Rate (SIP)",
      formula: "This Month Invested ÷ Monthly Salary",
      currentLabel: `${investmentPercent.toFixed(1)}% of salary (${formatIndianCurrency(monthlyInvested)}/mo)`,
      targetLabel: `Target ${thresholds.investmentTarget}% or more`,
      status: (investmentPercent >= thresholds.investmentTarget ? "green" : investmentPercent >= thresholds.investmentTarget * 0.5 ? "yellow" : "red") as "green" | "yellow" | "red",
      tip: investmentPercent < thresholds.investmentTarget
        ? `Increase monthly investments by ₹${formatIndianNumberOnly(Math.round(salary * (thresholds.investmentTarget / 100) - monthlyInvested))} to hit your ${thresholds.investmentTarget}% target.`
        : "Excellent savings allocation! You are setting up compounding success.",
      actionText: "Invest More",
      actionPath: "/investments",
      actionIcon: <TrendingUp className="w-4 h-4" />,
      thresholdKey: "investmentTarget" as keyof RuleThresholds,
      thresholdLabel: "Target Investment % of salary",
      thresholdSuffix: "%",
    },
    {
      id: "needs",
      name: "Needs & Essentials Ratio",
      formula: "Essentials (Food + Rent + Fuel + Utility) ÷ Monthly Salary",
      currentLabel: `${needsPercent.toFixed(1)}% of salary (${formatIndianCurrency(needsExpense)}/mo)`,
      targetLabel: `Limit to ${thresholds.needsLimit}% or less`,
      status: (needsPercent <= thresholds.needsLimit ? "green" : needsPercent <= thresholds.needsLimit * 1.2 ? "yellow" : "red") as "green" | "yellow" | "red",
      tip: needsPercent > thresholds.needsLimit
        ? `Needs exceed ${thresholds.needsLimit}% limit! Cut by ₹${formatIndianNumberOnly(Math.round(needsExpense - salary * (thresholds.needsLimit / 100)))} to free up cash flow.`
        : "Needs are well within budget! You have healthy surplus margins.",
      actionText: "Review Expenses",
      actionPath: "/transactions",
      actionIcon: <ArrowUpDown className="w-4 h-4" />,
      thresholdKey: "needsLimit" as keyof RuleThresholds,
      thresholdLabel: "Max Needs % of salary",
      thresholdSuffix: "%",
    },
    {
      id: "emergency",
      name: "Emergency Fund Shield",
      formula: "Liquid Emergency Savings vs Target",
      currentLabel: `${efProgressPercent.toFixed(1)}% funded (${formatIndianCurrency(efCurrent)} saved)`,
      targetLabel: `Fully Fund ${formatIndianCurrency(efTarget)}`,
      status: (efProgressPercent >= 100 ? "green" : efProgressPercent > 0 ? "yellow" : "red") as "green" | "yellow" | "red",
      tip: efProgressPercent < 100
        ? `Save ₹2,500/month → fund will be fully ready in ${Math.ceil((efTarget - efCurrent) / 2500)} months.`
        : "Shield fully charged! Your emergency reserve protects you from debt traps.",
      actionText: "Allocate Goals",
      actionPath: "/goals",
      actionIcon: <Target className="w-4 h-4" />,
      thresholdKey: "emergencyTarget" as keyof RuleThresholds,
      thresholdLabel: "Emergency Fund Target (₹)",
      thresholdSuffix: "₹",
    },
    {
      id: "savings_rate",
      name: "Overall Savings Rate",
      formula: "(Monthly Income − Monthly Expenses) ÷ Monthly Income",
      currentLabel: `${savingsRate.toFixed(1)}% savings rate`,
      targetLabel: `Target ${thresholds.savingsTarget}% or more`,
      status: (savingsRate >= thresholds.savingsTarget ? "green" : savingsRate >= thresholds.savingsTarget * 0.5 ? "yellow" : "red") as "green" | "yellow" | "red",
      tip: savingsRate < thresholds.savingsTarget
        ? `Boost savings rate to ${thresholds.savingsTarget}% by cutting luxury spending or growing income.`
        : "Fantastic savings rate! You are fast-tracking your financial freedom.",
      actionText: "Analyze Reports",
      actionPath: "/reports",
      actionIcon: <ArrowUpDown className="w-4 h-4" />,
      thresholdKey: "savingsTarget" as keyof RuleThresholds,
      thresholdLabel: "Target Savings % of income",
      thresholdSuffix: "%",
    },
  ];

  const getStatusDot = (s: "green" | "yellow" | "red") =>
    s === "green"
      ? <span className="w-3 h-3 rounded-full bg-emerald-500 shadow-md shadow-emerald-500/50 shrink-0" />
      : s === "yellow"
      ? <span className="w-3 h-3 rounded-full bg-amber-500 shadow-md shadow-amber-500/50 shrink-0" />
      : <span className="w-3 h-3 rounded-full bg-rose-500 shadow-md shadow-rose-500/50 shrink-0" />;

  const getBorderClass = (s: "green" | "yellow" | "red") =>
    s === "green" ? "border-emerald-500/15 hover:border-emerald-500/35"
    : s === "yellow" ? "border-amber-500/15 hover:border-amber-500/35"
    : "border-rose-500/15 hover:border-rose-500/35";

  // Custom rule spend this month
  const getCustomRuleStatus = (rule: CustomRule) => {
    const spent = currentMonthTxs
      .filter(t => t.type === "expense" && t.category.toLowerCase().includes(rule.category.toLowerCase()))
      .reduce((s, t) => s + Number(t.amount), 0);
    const pct = rule.limitAmount > 0 ? (spent / rule.limitAmount) * 100 : 0;
    const status: "green" | "yellow" | "red" = pct <= 80 ? "green" : pct <= 100 ? "yellow" : "red";
    return { spent, pct, status };
  };

  const openEditThreshold = (key: string, current: number) => {
    setEditingThreshold(key);
    setThresholdDraft(String(current));
    setExpandedRule(null);
  };

  const saveThresholdEdit = (key: keyof RuleThresholds) => {
    const val = parseFloat(thresholdDraft);
    if (isNaN(val) || val <= 0) return;
    saveThresholds({ ...thresholds, [key]: val });
    setEditingThreshold(null);
  };

  const openAddCustom = (existing?: CustomRule) => {
    if (existing) {
      setEditingCustom(existing);
      setCustomDraft({ name: existing.name, category: existing.category, limitAmount: existing.limitAmount, period: "monthly" });
    } else {
      setEditingCustom(null);
      setCustomDraft({ name: "", category: "", limitAmount: 0, period: "monthly" });
    }
    setShowAddCustom(true);
  };

  const saveCustomRule = () => {
    if (!customDraft.name || !customDraft.category || customDraft.limitAmount <= 0) return;
    if (editingCustom) {
      saveCustomRules(customRules.map(r => r.id === editingCustom.id ? { ...customDraft, id: editingCustom.id } : r));
    } else {
      saveCustomRules([...customRules, { ...customDraft, id: `cr_${Date.now()}` }]);
    }
    setShowAddCustom(false);
  };

  const deleteCustomRule = (id: string) => saveCustomRules(customRules.filter(r => r.id !== id));

  return (
    <div className="space-y-6 pb-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-extrabold m-0 text-foreground">Rules Dashboard</h2>
          <p className="text-muted-foreground text-sm mt-1">50-30-20 rule audit · click any rule to edit its target</p>
        </div>
        <button
          onClick={() => openAddCustom()}
          className="btn-primary flex items-center gap-1.5 px-4 py-2 text-sm shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Add Rule
        </button>
      </div>

      {/* Built-in rules */}
      <div className="space-y-3">
        {builtinRules.map((rule) => {
          const isOpen = expandedRule === rule.id;
          const isEditingThis = editingThreshold === rule.thresholdKey;

          return (
            <div key={rule.id} className={`hero-card rounded-2xl border transition-all duration-300 ${getBorderClass(rule.status)}`}>
              <div onClick={() => !isEditingThis && toggleExpand(rule.id)} className="flex items-center justify-between p-5 cursor-pointer select-none">
                <div className="flex items-center gap-3 min-w-0">
                  {getStatusDot(rule.status)}
                  <div className="min-w-0">
                    <h4 className="text-sm md:text-base font-bold text-foreground m-0 truncate">{rule.name}</h4>
                    <span className="text-xs text-muted-foreground block mt-0.5">{rule.currentLabel}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <span className="hidden md:inline text-xs font-semibold text-muted-foreground bg-muted/50 px-2.5 py-1 rounded-lg border border-border">
                    {rule.targetLabel}
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); openEditThreshold(rule.thresholdKey, thresholds[rule.thresholdKey]); }}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer"
                    title="Edit target"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </div>
              </div>

              {/* Inline threshold editor */}
              {isEditingThis && (
                <div className="px-5 pb-4 border-t border-border">
                  <p className="text-xs text-muted-foreground mt-3 mb-2">{rule.thresholdLabel}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">{rule.thresholdSuffix !== "%" ? rule.thresholdSuffix : ""}</span>
                    <input
                      type="number"
                      value={thresholdDraft}
                      onChange={e => setThresholdDraft(e.target.value)}
                      className="flex-1 bg-background border border-border rounded-xl px-3 py-2 text-foreground text-sm focus:outline-none focus:border-primary/50"
                      placeholder="Enter value"
                      autoFocus
                    />
                    {rule.thresholdSuffix === "%" && <span className="text-sm text-muted-foreground">%</span>}
                    <button onClick={() => saveThresholdEdit(rule.thresholdKey)} className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors cursor-pointer">
                      <Check className="w-4 h-4" />
                    </button>
                    <button onClick={() => setEditingThreshold(null)} className="p-2 rounded-xl bg-muted text-muted-foreground hover:bg-muted/80 transition-colors cursor-pointer">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* Expansion details */}
              {isOpen && !isEditingThis && (
                <div className="px-5 pb-5 pt-2 border-t border-border space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div className="space-y-1">
                      <span className="text-muted-foreground uppercase tracking-wider block">Formula</span>
                      <code className="text-primary bg-primary/10 px-2 py-1 rounded inline-block">{rule.formula}</code>
                    </div>
                    <div className="space-y-1">
                      <span className="text-muted-foreground uppercase tracking-wider block">Target Standard</span>
                      <span className="text-foreground font-medium">{rule.targetLabel}</span>
                    </div>
                  </div>
                  <div className="p-3.5 rounded-xl bg-muted/50 border border-border flex gap-3 items-start">
                    <ShieldCheck className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                    <div>
                      <span className="text-xs font-bold text-foreground block mb-1">Improvement Suggestion</span>
                      <p className="text-xs text-muted-foreground leading-relaxed m-0">{rule.tip}</p>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Link to={rule.actionPath} className="flex items-center gap-1.5 btn-primary px-4 py-2 text-xs">
                      {rule.actionIcon}{rule.actionText}<ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Custom rules */}
      {customRules.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest px-1">Custom Budget Rules</p>
          {customRules.map(rule => {
            const { spent, pct, status } = getCustomRuleStatus(rule);
            const isOpen = expandedRule === rule.id;
            return (
              <div key={rule.id} className={`hero-card rounded-2xl border transition-all duration-300 ${getBorderClass(status)}`}>
                <div onClick={() => toggleExpand(rule.id)} className="flex items-center justify-between p-5 cursor-pointer select-none">
                  <div className="flex items-center gap-3 min-w-0">
                    {getStatusDot(status)}
                    <div>
                      <h4 className="text-sm font-bold text-foreground m-0">{rule.name}</h4>
                      <span className="text-xs text-muted-foreground block mt-0.5">
                        {formatIndianCurrency(spent)} spent of {formatIndianCurrency(rule.limitAmount)} limit ({pct.toFixed(0)}%)
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <button onClick={(e) => { e.stopPropagation(); openAddCustom(rule); }} className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); deleteCustomRule(rule.id); }} className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </div>
                </div>
                {isOpen && (
                  <div className="px-5 pb-5 pt-2 border-t border-border space-y-3">
                    {/* Progress bar */}
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${status === "green" ? "bg-emerald-500" : status === "yellow" ? "bg-amber-500" : "bg-rose-500"}`}
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Category: <span className="text-foreground font-semibold">{rule.category}</span> · Monthly limit: <span className="text-foreground font-semibold">{formatIndianCurrency(rule.limitAmount)}</span>
                    </p>
                    {pct > 100 && (
                      <div className="flex items-center gap-2 text-xs text-rose-400">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        Over budget by {formatIndianCurrency(spent - rule.limitAmount)} this month!
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit custom rule modal */}
      {showAddCustom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="hero-card p-6 max-w-sm w-full space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-foreground">{editingCustom ? "Edit Rule" : "Add Custom Budget Rule"}</h3>
              <button onClick={() => setShowAddCustom(false)} className="text-muted-foreground hover:text-foreground cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Rule Name</label>
                <input
                  type="text"
                  placeholder="e.g. Monthly Food Budget"
                  value={customDraft.name}
                  onChange={e => setCustomDraft(d => ({ ...d, name: e.target.value }))}
                  className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-foreground text-sm focus:outline-none focus:border-primary/50"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Category Keyword</label>
                <input
                  type="text"
                  placeholder="e.g. Food, Fuel, Shopping"
                  value={customDraft.category}
                  onChange={e => setCustomDraft(d => ({ ...d, category: e.target.value }))}
                  className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-foreground text-sm focus:outline-none focus:border-primary/50"
                />
                <p className="text-[10px] text-muted-foreground mt-1">Matches any transaction category containing this word</p>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Monthly Limit (₹)</label>
                <input
                  type="number"
                  placeholder="e.g. 5000"
                  value={customDraft.limitAmount || ""}
                  onChange={e => setCustomDraft(d => ({ ...d, limitAmount: Number(e.target.value) }))}
                  className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-foreground text-sm focus:outline-none focus:border-primary/50"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-1">
              <button onClick={() => setShowAddCustom(false)} className="flex-1 py-2.5 text-sm font-semibold border border-border rounded-xl text-foreground hover:bg-muted transition-colors cursor-pointer">
                Cancel
              </button>
              <button
                onClick={saveCustomRule}
                disabled={!customDraft.name || !customDraft.category || customDraft.limitAmount <= 0}
                className="flex-1 btn-primary py-2.5 text-sm cursor-pointer disabled:opacity-50"
              >
                {editingCustom ? "Save Changes" : "Add Rule"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
