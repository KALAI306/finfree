import React, { useState } from "react";
import { useApp } from "../context/AppContext";
import { EXPENSE_CATEGORIES } from "./Transactions";
import { Modal } from "../components/Modal";
import { CustomSelect, NumberInput } from "../components/CustomSelect";
import {
  PiggyBank,
  Plus,
  Edit2,
  Trash2,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";

export const Budgets: React.FC = () => {
  const {
    budgetLimits,
    setBudgetLimit,
    removeBudgetLimit,
    transactions,
    customCategories,
    showToast,
    fmt: formatIndianCurrency,
  } = useApp();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [category, setCategory] = useState("");
  const [limitStr, setLimitStr] = useState("");

  const now = new Date();
  const monthSpend = (cat: string) =>
    transactions
      .filter(t => {
        if (t.type !== "expense" || t.category !== cat || t.transfer_to_account_id) return false;
        const d = new Date(t.date);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      })
      .reduce((s, t) => s + Number(t.amount), 0);

  const rows = Object.entries(budgetLimits)
    .map(([cat, limit]) => {
      const spent = monthSpend(cat);
      const pct = Number(limit) > 0 ? (spent / Number(limit)) * 100 : 0;
      const status: "ok" | "warning" | "over" = pct > 100 ? "over" : pct >= 80 ? "warning" : "ok";
      return { category: cat, limit: Number(limit), spent, pct, status };
    })
    .sort((a, b) => b.pct - a.pct);

  const overCount = rows.filter(r => r.status === "over").length;
  const warnCount = rows.filter(r => r.status === "warning").length;
  const totalLimit = rows.reduce((s, r) => s + r.limit, 0);
  const totalSpent = rows.reduce((s, r) => s + r.spent, 0);

  // Categories available to pick from — expense categories + custom, minus ones already budgeted (unless editing)
  const customExpenseCats = customCategories.filter(c => c.type === "expense");
  const allCategoryOptions = [
    ...EXPENSE_CATEGORIES.map(c => ({ value: c.name, label: c.name, icon: c.icon })),
    ...customExpenseCats.map(c => ({ value: c.name, label: c.name, icon: c.icon })),
  ].filter(c => editingCategory === c.value || !(c.value in budgetLimits));

  const openAdd = () => {
    setEditingCategory(null);
    setCategory("");
    setLimitStr("");
    setIsModalOpen(true);
  };

  const openEdit = (cat: string, limit: number) => {
    setEditingCategory(cat);
    setCategory(cat);
    setLimitStr(String(limit));
    setIsModalOpen(true);
  };

  const handleSave = () => {
    if (!category) { showToast("Choose a category", "warning"); return; }
    const amt = Number(limitStr);
    if (!amt || amt <= 0) { showToast("Enter a valid monthly limit", "warning"); return; }
    setBudgetLimit(category, amt);
    showToast(`Budget saved for ${category}`, "success");
    setIsModalOpen(false);
  };

  const handleDelete = (cat: string) => {
    if (!window.confirm(`Remove the budget limit for ${cat}?`)) return;
    removeBudgetLimit(cat);
    showToast(`Removed budget for ${cat}`, "info");
  };

  const barColor = (status: string) =>
    status === "over" ? "#f43f5e" : status === "warning" ? "#f59e0b" : "#10b981";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div>
          <h2 className="text-2xl md:text-3xl font-extrabold m-0 text-foreground">Budgets</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Set monthly spending limits and track them in real time
          </p>
        </div>
        <button
          onClick={openAdd}
          className="btn-gold flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Set Budget
        </button>
      </div>

      {/* Summary strip */}
      {rows.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="glass-card rounded-2xl p-4 border border-border">
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">Total Budgeted</p>
            <p className="text-xl font-bold text-foreground mt-1">{formatIndianCurrency(totalLimit)}</p>
          </div>
          <div className="glass-card rounded-2xl p-4 border border-border">
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">Spent This Month</p>
            <p className="text-xl font-bold text-foreground mt-1">{formatIndianCurrency(totalSpent)}</p>
          </div>
          <div className={`glass-card rounded-2xl p-4 border ${overCount > 0 ? "border-rose-500/30" : "border-border"}`}>
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">Over Budget</p>
            <p className={`text-xl font-bold mt-1 ${overCount > 0 ? "text-rose-400" : "text-foreground"}`}>{overCount}</p>
          </div>
          <div className={`glass-card rounded-2xl p-4 border ${warnCount > 0 ? "border-amber-500/30" : "border-border"}`}>
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">Near Limit</p>
            <p className={`text-xl font-bold mt-1 ${warnCount > 0 ? "text-amber-400" : "text-foreground"}`}>{warnCount}</p>
          </div>
        </div>
      )}

      {/* Budget rows */}
      {rows.length === 0 ? (
        <div className="glass-card rounded-2xl py-16 text-center text-muted-foreground border border-border space-y-3">
          <PiggyBank className="w-10 h-10 mx-auto opacity-30" />
          <p>No budgets set yet. Tap "Set Budget" to create your first limit.</p>
        </div>
      ) : (
        <div className="glass-card rounded-2xl p-6 border border-border space-y-5">
          {rows.map((r) => (
            <div key={r.category} className="group">
              <div className="flex items-center justify-between gap-3 mb-1.5 flex-wrap">
                <div className="flex items-center gap-2 min-w-0">
                  {r.status === "over" ? (
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  ) : r.status === "warning" ? (
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  )}
                  <span className="font-semibold text-foreground truncate">{r.category}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`text-sm font-bold ${
                      r.status === "over" ? "text-rose-400" : r.status === "warning" ? "text-amber-400" : "text-foreground"
                    }`}
                  >
                    {formatIndianCurrency(r.spent)} / {formatIndianCurrency(r.limit)}
                  </span>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => openEdit(r.category, r.limit)}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-gold-400 hover:bg-gold-400/10 transition-colors cursor-pointer"
                      title="Edit budget"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(r.category)}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                      title="Remove budget"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
              <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, r.pct)}%`, background: barColor(r.status) }}
                />
              </div>
              <div className="flex justify-between text-[11px] text-muted-foreground mt-1">
                <span>{r.pct.toFixed(0)}% used</span>
                <span>
                  {r.status === "over"
                    ? `₹${(r.spent - r.limit).toLocaleString("en-IN")} over`
                    : `${formatIndianCurrency(Math.max(0, r.limit - r.spent))} remaining`}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Set/Edit Budget Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingCategory ? "Edit Budget" : "Set Budget"}
      >
        <div className="space-y-4">
          <CustomSelect
            label="Category"
            options={allCategoryOptions}
            value={category}
            onChange={setCategory}
            placeholder="Select a category"
            disabled={!!editingCategory}
            searchable
          />
          <NumberInput
            label="Monthly Limit (₹)"
            value={limitStr}
            onChange={setLimitStr}
            decimals
            prefix="₹"
            placeholder="e.g. 3000"
          />
          <div className="flex gap-3 mt-6 pt-4 border-t border-border">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="flex-1 bg-muted hover:bg-muted/80 border border-border text-foreground font-semibold py-2.5 rounded-xl transition-all text-sm"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="flex-1 bg-gold-500 hover:bg-gold-600 text-white font-semibold py-2.5 rounded-xl transition-all shadow-lg hover:shadow-gold-500/30 text-sm"
            >
              Save Budget
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
