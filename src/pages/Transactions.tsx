import React, { useState } from "react";
import { useApp } from "../context/AppContext";
import { addTransaction, deleteTransaction, updateTransaction } from "../lib/db";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { 
  Plus, 
  Search, 
  Calendar, 
  ArrowUpRight, 
  ArrowDownRight, 
  ArrowRightLeft, 
  Trash2,
  Edit2,
  X,
  FileText
} from "lucide-react";
import { Modal } from "../components/Modal";
import { PdfParser } from "../components/PdfParser";
import type { Transaction } from "../lib/db";

// Categories definitions
export const EXPENSE_CATEGORIES = [
  { name: "Food 🍕", icon: "🍕" },
  { name: "Fuel ⛽", icon: "⛽" },
  { name: "Rent/PG 🏠", icon: "🏠" },
  { name: "EMI 💳", icon: "💳" },
  { name: "Healthcare 🏥", icon: "🏥" },
  { name: "Medical 💊", icon: "💊" },
  { name: "Shopping 🛍️", icon: "🛍️" },
  { name: "Recharges 📱", icon: "📱" },
  { name: "Gold Investment 🥇", icon: "🥇" },
  { name: "Investment 📈", icon: "📈" },
  { name: "Entertainment 🎬", icon: "🎬" },
  { name: "Clothing 👕", icon: "👕" },
  { name: "Daily Workers 👷", icon: "👷" },
  { name: "Miscellaneous 🎯", icon: "🎯" },
  { name: "Cash Withdrawal 💸", icon: "💸" }
];

export const INCOME_CATEGORIES = [
  { name: "Salary 💼", icon: "💼" },
  { name: "Family Support 👨👩👧", icon: "👨👩👧" },
  { name: "Transfer In 💰", icon: "💰" },
  { name: "Other Income 🎁", icon: "🎁" },
  { name: "Chit Fund Return 🎲", icon: "🎲" },
  { name: "Investment Return 📈", icon: "📈" }
];

// Zod Schema
const transactionSchema = z.object({
  type: z.enum(["income", "expense", "transfer"]),
  amount: z.coerce.number().positive("Amount must be greater than zero"),
  account_id: z.string().min(1, "Origin account is required"),
  category: z.string().min(1, "Category selection is required"),
  note: z.string().default(""),
  date: z.string().min(1, "Date selection is required"),
  is_recurring: z.boolean().default(false),
  transfer_to_account_id: z.string().optional().nullable(),
}).refine(data => {
  if (data.type === "transfer") {
    return data.transfer_to_account_id && data.transfer_to_account_id !== data.account_id;
  }
  return true;
}, {
  message: "Transfer destination account must differ from origin",
  path: ["transfer_to_account_id"]
});

type TransactionFormValues = z.infer<typeof transactionSchema>;

// Form Component
export const TransactionForm: React.FC<{ 
  onClose: () => void;
  transaction?: Transaction;
}> = ({ onClose, transaction }) => {
  const { accounts, user, showToast, refreshData, customCategories, addCustomCategory, editCustomCategory, deleteCustomCategory, fmt: formatIndianCurrency } = useApp();
  const [selectedType, setSelectedType] = useState<"income" | "expense" | "transfer">(
    transaction?.type || "expense"
  );
  const [showAddCustomCat, setShowAddCustomCat] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatIcon, setNewCatIcon] = useState("🎯");
  const [editingCat, setEditingCat] = useState<string | null>(null);
  const [editCatName, setEditCatName] = useState("");
  const [editCatIcon, setEditCatIcon] = useState("");

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<any>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      type: transaction?.type || "expense",
      amount: transaction?.amount || "",
      account_id: transaction?.account_id || "",
      category: transaction?.category || "",
      note: transaction?.note || "",
      date: transaction?.date ? transaction.date.split("T")[0] : new Date().toISOString().split("T")[0],
      is_recurring: transaction?.is_recurring || false,
      transfer_to_account_id: transaction?.transfer_to_account_id || ""
    }
  });

  const onSubmit = async (data: any) => {
    if (!user) return;
    try {
      if (transaction) {
        await updateTransaction({
          id: transaction.id,
          account_id: data.account_id,
          type: data.type,
          amount: data.amount,
          category: data.category,
          note: data.note,
          date: data.date,
          is_recurring: data.is_recurring,
          transfer_to_account_id: data.type === "transfer" ? data.transfer_to_account_id : null
        });
        showToast("Transaction updated successfully", "success");
      } else {
        await addTransaction({
          user_id: user.id,
          account_id: data.account_id,
          type: data.type,
          amount: data.amount,
          category: data.category,
          note: data.note,
          date: data.date,
          is_recurring: data.is_recurring,
          transfer_to_account_id: data.type === "transfer" ? data.transfer_to_account_id : null
        });
        showToast("Transaction saved successfully", "success");
      }

      refreshData();
      onClose();
    } catch (err: any) {
      console.error(err);
      showToast(err.message || "Failed to save transaction", "error");
    }
  };

  const handleTypeChange = (type: "income" | "expense" | "transfer") => {
    setSelectedType(type);
    setValue("type", type);
    if (type === "transfer") {
      setValue("category", "Transfer 💰");
    } else {
      setValue("category", "");
    }
  };

  const originAccount = watch("account_id");

  const getErrorMessage = (field: any) => {
    return field?.message?.toString() || "";
  };

  const defaultCategories = selectedType === "expense" ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
  const customCats = customCategories.filter(cat => cat.type === selectedType);
  const displayedCategories = [
    ...defaultCategories,
    ...customCats.map(cat => ({ name: cat.name, icon: cat.icon }))
  ];

  const currentCategoryVal = watch("category");
  if (currentCategoryVal && !displayedCategories.some(c => c.name === currentCategoryVal) && selectedType !== "transfer") {
    displayedCategories.push({
      name: currentCategoryVal,
      icon: "🏷️"
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Type Selector */}
      <div>
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2">Type</label>
        <div className="grid grid-cols-3 gap-2 bg-muted p-1 rounded-xl border border-border">
          {(["income", "expense", "transfer"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => handleTypeChange(t)}
              className={`py-2 px-3 rounded-lg text-xs font-bold uppercase transition-all ${
                selectedType === t
                  ? t === "income"
                    ? "bg-emerald-600 text-white"
                    : t === "expense"
                    ? "bg-rose-600 text-white"
                    : "bg-amber-600 text-white"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Amount input */}
      <div>
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Amount (₹)</label>
        <input
          type="number"
          step="any"
          placeholder="0.00"
          {...register("amount")}
          className="w-full bg-background border border-border rounded-xl py-2.5 px-3 text-foreground text-sm focus:outline-none focus:border-primary"
        />
        {errors.amount && <p className="text-rose-400 text-xs mt-1">{getErrorMessage(errors.amount)}</p>}
      </div>

      {/* Account selection */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
            {selectedType === "transfer" ? "From Account" : "Account"}
          </label>
          <select
            {...register("account_id")}
            className="w-full bg-background border border-border rounded-xl py-2.5 px-3 text-foreground text-sm focus:outline-none focus:border-primary"
          >
            <option value="">Select Account</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({formatIndianCurrency(a.balance)})
              </option>
            ))}
          </select>
          {errors.account_id && <p className="text-rose-400 text-xs mt-1">{getErrorMessage(errors.account_id)}</p>}
        </div>

        {selectedType === "transfer" && (
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">To Account</label>
            <select
              {...register("transfer_to_account_id")}
              className="w-full bg-background border border-border rounded-xl py-2.5 px-3 text-foreground text-sm focus:outline-none focus:border-primary"
            >
              <option value="">Select Account</option>
              {accounts
                .filter(a => a.id !== originAccount)
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({formatIndianCurrency(a.balance)})
                  </option>
                ))}
            </select>
            {errors.transfer_to_account_id && (
              <p className="text-rose-400 text-xs mt-1">{getErrorMessage(errors.transfer_to_account_id)}</p>
            )}
          </div>
        )}
      </div>

      {/* Category picker (for non-transfers) */}
      {selectedType !== "transfer" && (
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2">Category</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-36 overflow-y-auto p-1 bg-background border border-border rounded-xl">
            {displayedCategories.map((cat) => {
              const currentCat = watch("category");
              const isCustom = customCats.some(c => c.name === cat.name);
              return (
                <div key={cat.name} className="relative group/cat">
                  <button
                    type="button"
                    onClick={() => setValue("category", cat.name)}
                    className={`w-full flex items-center gap-2 p-2 rounded-lg text-xs font-semibold transition-all border text-left ${
                      currentCat === cat.name
                        ? "bg-primary/15 text-primary border-primary/30"
                        : "bg-transparent text-muted-foreground border-transparent hover:bg-muted"
                    }`}
                  >
                    <span>{cat.icon}</span>
                    <span className="truncate">{cat.name.replace(/\s[^\x00-\x7F]+$/, "").trim()}</span>
                  </button>
                  {isCustom && (
                    <div className="absolute -top-1 -right-1 hidden group-hover/cat:flex gap-0.5">
                      <button type="button" onClick={() => { setEditingCat(cat.name); setEditCatName(cat.name.replace(/\s[^\x00-\x7F]+$/, "").trim()); setEditCatIcon(cat.icon); }}
                        className="w-4 h-4 rounded-full bg-primary/80 text-white flex items-center justify-center"><Edit2 className="w-2.5 h-2.5" /></button>
                      <button type="button" onClick={() => { deleteCustomCategory(cat.name); if (currentCat === cat.name) setValue("category", ""); }}
                        className="w-4 h-4 rounded-full bg-rose-500/80 text-white flex items-center justify-center"><X className="w-2.5 h-2.5" /></button>
                    </div>
                  )}
                </div>
              );
            })}
            <button
              type="button"
              onClick={() => setShowAddCustomCat(true)}
              className="flex items-center justify-center gap-1.5 p-2 rounded-lg text-xs font-semibold border border-dashed border-border text-muted-foreground hover:text-foreground hover:border-primary transition-all bg-muted/30"
            >
              <Plus className="w-3 h-3" />
              <span>Custom...</span>
            </button>
          </div>

          {/* Edit Custom Category Inline */}
          {editingCat && (
            <div className="p-3 bg-card border border-primary/20 rounded-xl space-y-3 mt-2">
              <p className="text-xs font-semibold text-foreground">Edit Category</p>
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <input type="text" value={editCatName} onChange={(e) => setEditCatName(e.target.value)}
                    className="w-full bg-background border border-border rounded-lg py-1.5 px-2 text-foreground text-xs focus:outline-none focus:border-primary" />
                </div>
                <div>
                  <input type="text" value={editCatIcon} onChange={(e) => setEditCatIcon(e.target.value)}
                    className="w-full bg-background border border-border rounded-lg py-1.5 px-2 text-foreground text-xs text-center focus:outline-none focus:border-primary" />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setEditingCat(null)}
                  className="px-2.5 py-1 rounded bg-muted hover:bg-muted/80 text-foreground text-[10px] font-semibold">Cancel</button>
                <button type="button" onClick={() => {
                  if (!editCatName.trim()) return;
                  const newName = `${editCatName.trim()} ${editCatIcon.trim()}`;
                  editCustomCategory(editingCat, newName, editCatIcon.trim());
                  if (watch("category") === editingCat) setValue("category", newName);
                  setEditingCat(null);
                }} className="px-2.5 py-1 rounded bg-primary hover:bg-primary/80 text-white text-[10px] font-semibold">Save</button>
              </div>
            </div>
          )}
          {errors.category && <p className="text-rose-400 text-xs mt-1">{getErrorMessage(errors.category)}</p>}

          {/* Add Custom Category Inline Sub-Form */}
          {showAddCustomCat && (
            <div className="p-3 bg-card border border-border rounded-xl space-y-3 mt-2">
              <p className="text-xs font-semibold text-foreground">Add Custom Category</p>
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <input
                    type="text"
                    placeholder="Category Name"
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    className="w-full bg-background border border-border rounded-lg py-1.5 px-2 text-foreground text-xs focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <input
                    type="text"
                    placeholder="Emoji"
                    value={newCatIcon}
                    onChange={(e) => setNewCatIcon(e.target.value)}
                    className="w-full bg-background border border-border rounded-lg py-1.5 px-2 text-foreground text-xs text-center focus:outline-none focus:border-primary"
                  />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setShowAddCustomCat(false)}
                  className="px-2.5 py-1 rounded bg-muted hover:bg-muted/80 text-foreground text-[10px] font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!newCatName.trim()) return;
                    const fullCatName = `${newCatName.trim()} ${newCatIcon.trim()}`;
                    addCustomCategory(fullCatName, newCatIcon.trim(), selectedType);
                    setValue("category", fullCatName);
                    setNewCatName("");
                    setShowAddCustomCat(false);
                  }}
                  className="px-2.5 py-1 rounded bg-gold-500 hover:bg-violet-705 text-white text-[10px] font-semibold"
                >
                  Add
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Date & Note & Recurring */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Date</label>
          <input
            type="date"
            {...register("date")}
            className="w-full bg-background border border-border rounded-xl py-2.5 px-3 text-foreground text-sm focus:outline-none focus:border-primary"
          />
          {errors.date && <p className="text-rose-400 text-xs mt-1">{getErrorMessage(errors.date)}</p>}
        </div>

        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Note</label>
          <input
            type="text"
            placeholder="E.g., Dinner with friends"
            {...register("note")}
            className="w-full bg-background border border-border rounded-xl py-2.5 px-3 text-foreground text-sm focus:outline-none focus:border-primary"
          />
        </div>
      </div>

      <div className="flex items-center gap-3 py-2">
        <input
          type="checkbox"
          id="is_recurring"
          {...register("is_recurring")}
          className="w-4.5 h-4.5 rounded bg-background border-border text-gold-500 focus:ring-violet-500"
        />
        <label htmlFor="is_recurring" className="text-xs text-muted-foreground font-medium">
          Set as recurring monthly transaction (SIP)
        </label>
      </div>

      <div className="flex gap-3 mt-4 pt-4 border-t border-border">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 bg-muted hover:bg-muted/80 border border-border text-foreground font-semibold py-2.5 rounded-xl transition-all text-sm"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="flex-1 btn-primary py-2.5"
        >
          Save Transaction
        </button>
      </div>
    </form>
  );
};

// Strip trailing emoji from category names (e.g. "Food 🍕" → "Food")
function stripCategoryEmoji(cat: string): string {
  const parts = cat.split(" ");
  while (parts.length > 1 && /[^\x00-\x7F]/.test(parts[parts.length - 1])) {
    parts.pop();
  }
  return parts.join(" ");
}

// Main Transactions Page Component
export const Transactions: React.FC = () => {
  const { transactions, accounts, showToast, refreshData, fmt: formatIndianCurrency } = useApp();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredTxs.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredTxs.map(t => t.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`Delete ${selectedIds.size} selected transaction${selectedIds.size > 1 ? 's' : ''}? This will reverse all balance updates.`)) return;
    setBulkDeleting(true);
    try {
      for (const id of selectedIds) {
        await deleteTransaction(id);
      }
      showToast(`Deleted ${selectedIds.size} transaction${selectedIds.size > 1 ? 's' : ''}`, "info");
      setSelectedIds(new Set());
      refreshData();
    } catch (err) {
      showToast("Failed to delete some transactions", "error");
    } finally {
      setBulkDeleting(false);
    }
  };

  // Filters state
  const [activeTab, setActiveTab] = useState<"all" | "income" | "expense" | "transfer">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAccount, setSelectedAccount] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const handleClearFilters = () => {
    setSearchQuery("");
    setSelectedAccount("");
    setStartDate("");
    setEndDate("");
  };

  // Filter logic
  const filteredTxs = transactions.filter((tx) => {
    if (activeTab !== "all" && tx.type !== activeTab) return false;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const noteMatch = tx.note?.toLowerCase().includes(q);
      const catMatch = tx.category.toLowerCase().includes(q);
      if (!noteMatch && !catMatch) return false;
    }

    if (selectedAccount && tx.account_id !== selectedAccount && tx.transfer_to_account_id !== selectedAccount) return false;

    if (startDate && new Date(tx.date) < new Date(startDate)) return false;
    if (endDate && new Date(tx.date) > new Date(endDate)) return false;

    return true;
  });

  const totalIncome = filteredTxs.filter(t => t.type === "income").reduce((sum, t) => sum + Number(t.amount), 0);
  const totalExpense = filteredTxs.filter(t => t.type === "expense").reduce((sum, t) => sum + Number(t.amount), 0);
  const netSaved = totalIncome - totalExpense;

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this transaction? This will reverse the account balance update.")) return;
    try {
      await deleteTransaction(id);
      showToast("Transaction deleted and balance adjusted", "info");
      refreshData();
    } catch (err) {
      showToast("Failed to delete transaction", "error");
    }
  };

  const getTxIcon = (tx: any) => {
    if (tx.type === "transfer") return "💰";
    
    const expenseMatch = EXPENSE_CATEGORIES.find(c => tx.category.includes(c.name.split(" ")[0]));
    if (expenseMatch) return expenseMatch.icon;
    
    const incomeMatch = INCOME_CATEGORIES.find(c => tx.category.includes(c.name.split(" ")[0]));
    if (incomeMatch) return incomeMatch.icon;
    
    return "🎯";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl md:text-3xl font-extrabold m-0 text-foreground">Transactions</h2>
          <p className="text-muted-foreground text-sm mt-1">Manage and audit your transaction history</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setIsImportOpen(true)}
            className="flex items-center justify-center gap-2 bg-muted hover:bg-muted/80 text-foreground font-semibold px-4 py-2.5 rounded-xl border border-border transition-all text-sm"
          >
            <FileText className="w-4 h-4" />
            Import Statement
          </button>
          <button
            onClick={() => setIsAddOpen(true)}
            className="btn-primary flex items-center gap-2 px-4 py-2.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add New
          </button>
        </div>
      </div>

      {/* Summary P&L Header */}
      <div className="grid grid-cols-3 gap-4 aurora-card p-4">
        <div className="text-center">
          <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold block">Total In</span>
          <span className="text-sm md:text-lg font-bold text-emerald-500 mt-1 block">
            +{formatIndianCurrency(totalIncome)}
          </span>
        </div>
        <div className="text-center border-x border-border">
          <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold block">Total Out</span>
          <span className="text-sm md:text-lg font-bold text-rose-500 mt-1 block">
            -{formatIndianCurrency(totalExpense)}
          </span>
        </div>
        <div className="text-center">
          <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold block">Net Change</span>
          <span className={`text-sm md:text-lg font-bold mt-1 block ${netSaved >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
            {netSaved >= 0 ? "+" : ""}{formatIndianCurrency(netSaved)}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-muted p-1 rounded-xl border border-border overflow-x-auto">
        {(["all", "income", "expense", "transfer"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 min-w-[70px] py-2 px-3 text-xs md:text-sm font-semibold capitalize rounded-lg transition-all ${
              activeTab === tab
                ? "bg-primary text-primary-foreground shadow"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Filters Form Container */}
      <div className="aurora-card p-4 space-y-4">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search bar */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search note or category..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-background border border-border rounded-xl py-2 pl-9 pr-4 text-foreground text-xs md:text-sm focus:outline-none focus:border-primary"
            />
          </div>
          
          {/* Account Filter */}
          <select
            value={selectedAccount}
            onChange={(e) => setSelectedAccount(e.target.value)}
            className="bg-background border border-border rounded-xl py-2 px-3 text-foreground text-xs md:text-sm focus:outline-none focus:border-primary"
          >
            <option value="">All Accounts</option>
            {accounts.map(acc => (
              <option key={acc.id} value={acc.id}>{acc.name}</option>
            ))}
          </select>
        </div>

        {/* Date Filters Row */}
        <div className="flex flex-col md:flex-row items-end md:items-center gap-3 pt-2 border-t border-border">
          <div className="flex items-center gap-2 w-full md:w-auto">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Date:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-background border border-border rounded-xl py-1 px-2 text-foreground text-xs focus:outline-none focus:border-primary"
            />
            <span className="text-xs text-muted-foreground">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-background border border-border rounded-xl py-1 px-2 text-foreground text-xs focus:outline-none focus:border-primary"
            />
          </div>

          {(searchQuery || selectedAccount || startDate || endDate) && (
            <button
              onClick={handleClearFilters}
              className="text-xs text-rose-500 hover:text-rose-605 font-semibold flex items-center gap-1 ml-auto transition-colors"
            >
              <X className="w-3.5 h-3.5" /> Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Bulk Actions */}
      {filteredTxs.length > 0 && (
        <div className="flex items-center justify-between px-1">
          <button
            onClick={toggleSelectAll}
            className="text-xs text-primary hover:underline font-semibold cursor-pointer"
          >
            {selectedIds.size === filteredTxs.length ? "Deselect All" : "Select All"}
          </button>
          {selectedIds.size > 0 && (
            <button
              onClick={handleBulkDelete}
              disabled={bulkDeleting}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {bulkDeleting ? "Deleting..." : `Delete Selected (${selectedIds.size})`}
            </button>
          )}
        </div>
      )}

      {/* Transactions Table / List Container */}
      <div className="aurora-card p-4">
        {filteredTxs.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">
            No transactions match the active filters.
          </div>
        ) : (
          <>
            {/* Mobile View: Compact list (block md:hidden) */}
            <div className="block md:hidden divide-y divide-border">
              {filteredTxs.map((tx) => {
                const account = accounts.find((a) => a.id === tx.account_id);
                const toAccount = tx.transfer_to_account_id ? accounts.find(a => a.id === tx.transfer_to_account_id) : null;
                const isIncome = tx.type === "income";
                const isTransfer = tx.type === "transfer";

                return (
                  <div key={tx.id} className="flex justify-between items-center py-4 hover:bg-muted/30 transition-colors px-2 -mx-2 rounded-lg group">
                    <div className="flex items-center gap-3 min-w-0">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(tx.id)}
                        onChange={() => toggleSelect(tx.id)}
                        className="w-4 h-4 rounded border-border text-primary shrink-0 cursor-pointer"
                      />
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0 ${
                        isIncome 
                          ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" 
                          : isTransfer 
                          ? "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                          : "bg-rose-500/10 text-rose-500 border border-rose-500/20"
                      }`}>
                        {getTxIcon(tx)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-foreground truncate m-0">{tx.note || tx.category}</p>
                          {tx.is_recurring && (
                            <span className="px-1.5 py-0.5 rounded bg-violet-500/15 border border-gold-500/20 text-[9px] text-gold-400 font-semibold">
                              SIP
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-muted-foreground flex flex-wrap items-center gap-1.5 mt-1">
                          <span>{stripCategoryEmoji(tx.category)}</span>
                          <span>•</span>
                          {isTransfer ? (
                            <span>{account?.name} → {toAccount?.name}</span>
                          ) : (
                            <span>{account?.name}</span>
                          )}
                          <span>•</span>
                          <span>{new Date(tx.date).toLocaleDateString("en-IN", { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className={`text-sm font-bold ${
                        isIncome ? "text-emerald-500" : isTransfer ? "text-amber-500" : "text-rose-500"
                      }`}>
                        {isIncome ? "+" : isTransfer ? "" : "-"}{formatIndianCurrency(tx.amount)}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setEditingTransaction(tx)}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-gold-400 hover:bg-gold-400/10 transition-all"
                          title="Edit"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(tx.id)}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-all"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop View: Structured Table Layout (hidden md:block) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    <th className="py-3 px-2 w-8">
                      <input
                        type="checkbox"
                        checked={selectedIds.size === filteredTxs.length && filteredTxs.length > 0}
                        onChange={toggleSelectAll}
                        className="w-4 h-4 rounded border-border text-primary cursor-pointer"
                      />
                    </th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Note / Description</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Account</th>
                    <th className="py-3 px-4 text-right">Amount</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredTxs.map((tx) => {
                    const account = accounts.find((a) => a.id === tx.account_id);
                    const toAccount = tx.transfer_to_account_id ? accounts.find(a => a.id === tx.transfer_to_account_id) : null;
                    const isIncome = tx.type === "income";
                    const isTransfer = tx.type === "transfer";

                    return (
                      <tr key={tx.id} className="hover:bg-muted/20 transition-colors group">
                        <td className="py-3.5 px-2 w-8">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(tx.id)}
                            onChange={() => toggleSelect(tx.id)}
                            className="w-4 h-4 rounded border-border text-primary cursor-pointer"
                          />
                        </td>
                        <td className="py-3.5 px-4 text-sm text-foreground/90 whitespace-nowrap">
                          {new Date(tx.date).toLocaleDateString("en-IN", { day: '2-digit', month: 'short', year: 'numeric' })}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            isIncome 
                              ? "bg-emerald-500/15 text-emerald-500 border border-emerald-500/20" 
                              : isTransfer 
                              ? "bg-amber-500/15 text-amber-500 border border-amber-500/20"
                              : "bg-rose-500/15 text-rose-500 border border-rose-500/20"
                          }`}>
                            {tx.type}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-foreground truncate max-w-[200px]" title={tx.note}>
                              {tx.note || "-"}
                            </span>
                            {tx.is_recurring && (
                              <span className="px-1.5 py-0.5 rounded bg-violet-500/15 border border-gold-500/20 text-[9px] text-gold-400 font-bold uppercase whitespace-nowrap">
                                SIP
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-sm text-foreground/90 whitespace-nowrap">
                          <span className="flex items-center gap-1.5">
                            <span>{getTxIcon(tx)}</span>
                            <span>{stripCategoryEmoji(tx.category)}</span>
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-sm text-foreground/90 whitespace-nowrap">
                          {isTransfer ? (
                            <span>{account?.name} → {toAccount?.name}</span>
                          ) : (
                            <span>{account?.name || "-"}</span>
                          )}
                        </td>
                        <td className={`py-3.5 px-4 text-sm font-bold text-right whitespace-nowrap ${
                          isIncome ? "text-emerald-500" : isTransfer ? "text-amber-500" : "text-rose-500"
                        }`}>
                          {isIncome ? "+" : isTransfer ? "" : "-"}{formatIndianCurrency(tx.amount)}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => setEditingTransaction(tx)}
                              className="p-1.5 rounded-lg text-muted-foreground hover:text-gold-400 hover:bg-gold-400/10 transition-all"
                              title="Edit Transaction"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(tx.id)}
                              className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-all"
                              title="Delete Transaction"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Add Modal */}
      <Modal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title="Add Transaction">
        <TransactionForm onClose={() => {
          setIsAddOpen(false);
          refreshData();
        }} />
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={editingTransaction !== null} onClose={() => setEditingTransaction(null)} title="Edit Transaction">
        {editingTransaction && (
          <TransactionForm 
            transaction={editingTransaction}
            onClose={() => {
              setEditingTransaction(null);
              refreshData();
            }} 
          />
        )}
      </Modal>

      {/* Import Modal */}
      <Modal isOpen={isImportOpen} onClose={() => setIsImportOpen(false)} title="Import Bank Statement">
        <PdfParser onClose={() => {
          setIsImportOpen(false);
          refreshData();
        }} />
      </Modal>
    </div>
  );
};
