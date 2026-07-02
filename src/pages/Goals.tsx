import React, { useState, useRef } from "react";
import { useApp } from "../context/AppContext";
import type { ToastType } from "../context/AppContext";
import { compressImage } from "../lib/utils";
import { addGoal, updateGoal, deleteGoal, updateAccountBalance } from "../lib/db";
import {
  Plus,
  Coins,
  Trash2,
  Edit2,
  CheckCircle,
  Sparkles,
  Upload,
  RefreshCw,
  Target,
} from "lucide-react";
import { Modal } from "../components/Modal";
import { CustomSelect, NumberInput } from "../components/CustomSelect";
import confetti from "canvas-confetti";
import type { Goal } from "../lib/db";

// ── Goal icon options (Improvement #9) ──────────────────────────────────────
const GOAL_ICONS = ["💰", "🏠", "🚗", "✈️", "📱", "🎓", "💍", "🛡️", "🏋️", "🎁"];

// ── Day-of-month options for auto-contribution (Improvement #8) ──────────────
const DAY_OPTIONS = Array.from({ length: 28 }, (_, i) => ({
  value: String(i + 1),
  label: `${i + 1}${i + 1 === 1 ? "st" : i + 1 === 2 ? "nd" : i + 1 === 3 ? "rd" : "th"
    }`,
}));

interface SipConfig {
  monthlyAmount: number;
  day: string;
  accountId: string;
}

function loadSip(goalId: string): SipConfig | null {
  try {
    const raw = localStorage.getItem(`goal_sip_${goalId}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveSip(goalId: string, cfg: SipConfig) {
  localStorage.setItem(`goal_sip_${goalId}`, JSON.stringify(cfg));
}

function clearSip(goalId: string) {
  localStorage.removeItem(`goal_sip_${goalId}`);
}

function loadIcon(goalId: string): string {
  return localStorage.getItem(`goal_icon_${goalId}`) || "";
}

function saveIcon(goalId: string, icon: string) {
  if (icon) {
    localStorage.setItem(`goal_icon_${goalId}`, icon);
  } else {
    localStorage.removeItem(`goal_icon_${goalId}`);
  }
}

// ── Shared icon picker ───────────────────────────────────────────────────────
const GoalIconPicker: React.FC<{
  value: string;
  onChange: (icon: string) => void;
}> = ({ value, onChange }) => (
  <div>
    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2">
      Quick Icon
    </label>
    <div className="flex flex-wrap gap-2">
      {GOAL_ICONS.map((icon) => (
        <button
          key={icon}
          type="button"
          onClick={() => onChange(value === icon ? "" : icon)}
          className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl border transition-all ${value === icon
              ? "border-violet-500 bg-violet-500/15 scale-110 shadow-md"
              : "border-border bg-muted hover:border-violet-400 hover:bg-violet-500/10"
            }`}
        >
          {icon}
        </button>
      ))}
    </div>
  </div>
);

// ── Shared auto-contribution section ────────────────────────────────────────
const AutoContributionSection: React.FC<{
  sipEnabled: boolean;
  setSipEnabled: (v: boolean) => void;
  sipAmount: string;
  setSipAmount: (v: string) => void;
  sipDay: string;
  setSipDay: (v: string) => void;
  sipAccountId: string;
  setSipAccountId: (v: string) => void;
  accounts: { id: string; name: string; balance: number }[];
  fmt: (n: number) => string;
}> = ({
  sipEnabled,
  setSipEnabled,
  sipAmount,
  setSipAmount,
  sipDay,
  setSipDay,
  sipAccountId,
  setSipAccountId,
  accounts,
  fmt,
}) => {
    const accountOptions = accounts.map((a) => ({
      value: a.id,
      label: `${a.name} (${fmt(a.balance)})`,
    }));

    return (
      <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <RefreshCw className="w-3.5 h-3.5 text-violet-400" />
            Auto-Contribution (Optional)
          </span>
          <button
            type="button"
            onClick={() => setSipEnabled(!sipEnabled)}
            className={`relative w-9 h-5 rounded-full transition-colors ${sipEnabled ? "bg-violet-500" : "bg-muted-foreground/30"
              }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${sipEnabled ? "translate-x-4" : "translate-x-0"
                }`}
            />
          </button>
        </div>

        {sipEnabled && (
          <div className="space-y-3">
            <NumberInput
              label="Monthly Amount (₹)"
              value={sipAmount || ""}
              onChange={setSipAmount}
              prefix="₹"
              placeholder="2000"
              decimals={false}
            />
            <div className="grid grid-cols-2 gap-3">
              <CustomSelect
                label="Transfer on day"
                options={DAY_OPTIONS}
                value={sipDay}
                onChange={setSipDay}
                placeholder="Select day"
              />
              <CustomSelect
                label="From account"
                options={accountOptions}
                value={sipAccountId}
                onChange={setSipAccountId}
                placeholder="Select account"
              />
            </div>
          </div>
        )}
      </div>
    );
  };

// ── Edit Goal inline form ────────────────────────────────────────────────────
const EditGoalForm: React.FC<{
  goal: Goal;
  onClose: () => void;
  goalBgImages: Record<string, string>;
  updateGoalBgImage: (id: string, url: string) => void;
  showToast: (msg: string, type: ToastType) => void;
  refreshData: () => void;
  accounts: { id: string; name: string; balance: number }[];
  fmt: (n: number) => string;
}> = ({
  goal,
  onClose,
  goalBgImages,
  updateGoalBgImage,
  showToast,
  refreshData,
  accounts,
  fmt,
}) => {
    const [name, setName] = useState(goal.name);
    const [target, setTarget] = useState(goal.target_amount.toString());
    const [current, setCurrent] = useState(goal.current_amount.toString());
    const [deadline, setDeadline] = useState(
      goal.deadline ? goal.deadline.split("T")[0] : ""
    );
    const [bgUrl, setBgUrl] = useState(goalBgImages[goal.id] || "");
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Icon state
    const [goalIcon, setGoalIconState] = useState(() => loadIcon(goal.id));

    // SIP state
    const existingSip = loadSip(goal.id);
    const [sipEnabled, setSipEnabled] = useState(!!existingSip);
    const [sipAmount, setSipAmount] = useState(
      existingSip ? String(existingSip.monthlyAmount) : ""
    );
    const [sipDay, setSipDay] = useState(existingSip?.day || "");
    const [sipAccountId, setSipAccountId] = useState(existingSip?.accountId || "");

    const PRESET_GOAL_BGS = [
      {
        name: "Emergency 🛡️",
        url: "https://images.unsplash.com/photo-1579621970795-87faff3f0768?auto=format&fit=crop&w=400&q=80",
      },
      {
        name: "House 🏠",
        url: "https://images.unsplash.com/photo-1570129477492-45c003edd2be?auto=format&fit=crop&w=400&q=80",
      },
      {
        name: "Car/Bike 🚗",
        url: "https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=400&q=80",
      },
      {
        name: "Gadgets 💻",
        url: "https://images.unsplash.com/photo-1591488320449-011701bb6704?auto=format&fit=crop&w=400&q=80",
      },
      {
        name: "Travel ✈️",
        url: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=400&q=80",
      },
      {
        name: "Education 🎓",
        url: "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&w=400&q=80",
      },
    ];

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setUploading(true);
      try {
        const base64Data = await compressImage(file, 800, 600, 0.7);
        setBgUrl(base64Data);
        showToast("Background image compressed & loaded!", "success");
      } catch {
        showToast("Failed to parse image file", "error");
      } finally {
        setUploading(false);
      }
    };

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!name || !target) {
        showToast("Please fill in goal name and target", "warning");
        return;
      }
      try {
        await updateGoal({
          id: goal.id,
          name,
          target_amount: Number(target),
          current_amount: Number(current),
          deadline: deadline || null,
        });
        updateGoalBgImage(goal.id, bgUrl);
        saveIcon(goal.id, goalIcon);

        if (sipEnabled && sipAmount && sipDay && sipAccountId) {
          saveSip(goal.id, {
            monthlyAmount: Number(sipAmount),
            day: sipDay,
            accountId: sipAccountId,
          });
        } else {
          clearSip(goal.id);
        }

        showToast("Goal updated successfully", "success");
        refreshData();
        onClose();
      } catch {
        showToast("Failed to update goal", "error");
      }
    };

    return (
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
            Goal Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-background border border-border rounded-xl min-h-[48px] py-3 px-3.5 text-foreground text-sm focus:outline-none focus:border-gold-500"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <NumberInput
            label="Target (₹)"
            value={target || ""}
            onChange={setTarget}
            prefix="₹"
            decimals={false}
          />
          <NumberInput
            label="Current (₹)"
            value={current || ""}
            onChange={setCurrent}
            prefix="₹"
            decimals={false}
          />
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
              Target Date
            </label>
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="w-full bg-background border border-border rounded-xl min-h-[48px] py-3 px-3.5 text-foreground text-sm focus:outline-none focus:border-gold-500"
            />
          </div>
        </div>

        {/* #9 — Goal category icons */}
        <GoalIconPicker value={goalIcon} onChange={setGoalIconState} />

        {/* Background image */}
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
            Background Image URL
          </label>
          <input
            type="text"
            placeholder="Paste avatar URL or select preset below"
            value={bgUrl}
            onChange={(e) => setBgUrl(e.target.value)}
            className="w-full bg-background border border-border rounded-xl min-h-[48px] py-3 px-3.5 text-foreground text-sm focus:outline-none focus:border-gold-500 mb-2"
          />
          <div className="flex gap-2 items-center flex-wrap">
            {PRESET_GOAL_BGS.map((bg, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setBgUrl(bg.url)}
                className={`px-2 py-1 rounded-lg bg-muted text-[10px] font-bold text-muted-foreground border hover:text-foreground border-border ${bgUrl === bg.url
                    ? "border-violet-600 text-gold-400 dark:text-gold-300"
                    : "border-transparent"
                  }`}
              >
                {bg.name.split(" ")[0]}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setBgUrl("")}
              className={`px-2 py-1 rounded-lg bg-muted text-[10px] font-bold text-muted-foreground border border-border hover:text-foreground ${!bgUrl ? "border-violet-600" : "border-transparent"
                }`}
            >
              No Image
            </button>
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="px-2 py-1 rounded-lg bg-muted text-[10px] font-bold text-muted-foreground border border-border hover:text-foreground border-transparent flex items-center gap-1 transition-all"
            >
              <Upload className="w-3 h-3 text-gold-400" />
              {uploading ? "Compressing..." : "Upload File"}
            </button>
          </div>
        </div>

        {/* #8 — Auto-contribution */}
        <AutoContributionSection
          sipEnabled={sipEnabled}
          setSipEnabled={setSipEnabled}
          sipAmount={sipAmount}
          setSipAmount={setSipAmount}
          sipDay={sipDay}
          setSipDay={setSipDay}
          sipAccountId={sipAccountId}
          setSipAccountId={setSipAccountId}
          accounts={accounts}
          fmt={fmt}
        />

        <div className="flex gap-3 mt-6 pt-4 border-t border-border">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 bg-muted hover:bg-muted/80 border border-border text-foreground font-semibold py-3 rounded-xl transition-all text-sm"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="flex-1 bg-gold-500 hover:bg-gold-600 text-white font-semibold py-3 rounded-xl transition-all shadow-lg hover:shadow-gold-500/30 text-sm"
          >
            Save Changes
          </button>
        </div>
      </form>
    );
  };

// ── Main component ───────────────────────────────────────────────────────────
export const Goals: React.FC = () => {
  const {
    goals,
    accounts,
    profile,
    emis,
    transactions,
    showToast,
    refreshData,
    goalBgImages,
    updateGoalBgImage,
    fmt: formatIndianCurrency,
  } = useApp();

  const [isAddGoalOpen, setIsAddGoalOpen] = useState(false);
  const [isAddFundsOpen, setIsAddFundsOpen] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<any | null>(null);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);

  // Add Funds
  const [fundAmount, setFundAmount] = useState("");
  const [fundSourceAccount, setFundSourceAccount] = useState("");

  // Add Goal form
  const [newGoalName, setNewGoalName] = useState("");
  const [newGoalTarget, setNewGoalTarget] = useState("");
  const [newGoalDeadline, setNewGoalDeadline] = useState("");
  const [newGoalBgUrl, setNewGoalBgUrl] = useState("");
  const [uploadingGoalBg, setUploadingGoalBg] = useState(false);
  const goalBgInputRef = useRef<HTMLInputElement>(null);

  // New goal icon (#9)
  const [newGoalIcon, setNewGoalIcon] = useState("");

  // New goal SIP (#8)
  const [newSipEnabled, setNewSipEnabled] = useState(false);
  const [newSipAmount, setNewSipAmount] = useState("");
  const [newSipDay, setNewSipDay] = useState("");
  const [newSipAccountId, setNewSipAccountId] = useState("");

  const PRESET_GOAL_BGS = [
    {
      name: "Emergency 🛡️",
      url: "https://images.unsplash.com/photo-1579621970795-87faff3f0768?auto=format&fit=crop&w=400&q=80",
    },
    {
      name: "House 🏠",
      url: "https://images.unsplash.com/photo-1570129477492-45c003edd2be?auto=format&fit=crop&w=400&q=80",
    },
    {
      name: "Car/Bike 🚗",
      url: "https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=400&q=80",
    },
    {
      name: "Gadgets 💻",
      url: "https://images.unsplash.com/photo-1591488320449-011701bb6704?auto=format&fit=crop&w=400&q=80",
    },
    {
      name: "Travel ✈️",
      url: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=400&q=80",
    },
    {
      name: "Education 🎓",
      url: "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&w=400&q=80",
    },
  ];

  const handleGoalBgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingGoalBg(true);
    try {
      const base64Data = await compressImage(file, 800, 600, 0.7);
      setNewGoalBgUrl(base64Data);
      showToast("Background image compressed & loaded!", "success");
    } catch {
      showToast("Failed to parse background image file", "error");
    } finally {
      setUploadingGoalBg(false);
    }
  };

  // Monthly surplus calculation
  const monthlySalary = profile ? Number(profile.monthly_salary) : 20000;
  const now = new Date();
  const currentMonthTxs = transactions.filter((t) => {
    const d = new Date(t.date);
    return (
      d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
    );
  });
  const monthlyExpense = currentMonthTxs
    .filter((t) => t.type === "expense" && !t.category.includes("EMI"))
    .reduce((sum, t) => sum + Number(t.amount), 0);
  const totalMonthlyEmi = emis.reduce((sum, e) => sum + Number(e.emi_amount), 0);
  const monthlySurplus = Math.max(0, monthlySalary - monthlyExpense - totalMonthlyEmi);
  const activeGoals = goals.filter(
    (g) => Number(g.current_amount) < Number(g.target_amount)
  );
  const goalAllocation =
    activeGoals.length > 0
      ? (monthlySurplus > 0 ? monthlySurplus : 1000) / activeGoals.length
      : 1000;

  const handleAddGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGoalName || !newGoalTarget) {
      showToast("Please fill in goal name and target", "warning");
      return;
    }
    try {
      const newG = await addGoal({
        user_id: profile!.id,
        name: newGoalName,
        target_amount: Number(newGoalTarget),
        current_amount: 0,
        deadline: newGoalDeadline || null,
      });

      if (newGoalBgUrl) {
        updateGoalBgImage(newG.id, newGoalBgUrl);
      }
      saveIcon(newG.id, newGoalIcon);
      if (newSipEnabled && newSipAmount && newSipDay && newSipAccountId) {
        saveSip(newG.id, {
          monthlyAmount: Number(newSipAmount),
          day: newSipDay,
          accountId: newSipAccountId,
        });
      }

      showToast("Goal created successfully", "success");
      setNewGoalName("");
      setNewGoalTarget("");
      setNewGoalDeadline("");
      setNewGoalBgUrl("");
      setNewGoalIcon("");
      setNewSipEnabled(false);
      setNewSipAmount("");
      setNewSipDay("");
      setNewSipAccountId("");
      setIsAddGoalOpen(false);
      refreshData();
    } catch {
      showToast("Failed to create goal", "error");
    }
  };

  const handleAddFunds = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGoal || !fundAmount || !fundSourceAccount) {
      showToast("Please complete all fields", "warning");
      return;
    }
    const amt = Number(fundAmount);
    if (isNaN(amt) || amt <= 0) {
      showToast("Please enter a valid positive amount", "warning");
      return;
    }
    const account = accounts.find((a) => a.id === fundSourceAccount);
    if (!account) return;
    if (account.balance < amt) {
      showToast(`Insufficient balance in ${account.name}`, "error");
      return;
    }
    try {
      const nextAmount = Number(selectedGoal.current_amount) + amt;
      const target = Number(selectedGoal.target_amount);
      await updateAccountBalance(account.id, -amt);
      await updateGoal({ id: selectedGoal.id, current_amount: nextAmount });

      if (nextAmount >= target) {
        confetti({ particleCount: 150, spread: 85, origin: { y: 0.6 } });
        showToast(`🎉 Goal Complete! Reached ${selectedGoal.name}!`, "success");
      } else {
        showToast(
          `Added ${formatIndianCurrency(amt)} to ${selectedGoal.name}`,
          "success"
        );
      }

      setFundAmount("");
      setFundSourceAccount("");
      setIsAddFundsOpen(false);
      refreshData();
    } catch (err) {
      console.error(err);
      showToast("Failed to add funds", "error");
    }
  };

  const handleDeleteGoal = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this goal?")) return;
    try {
      await deleteGoal(id);
      clearSip(id);
      localStorage.removeItem(`goal_icon_${id}`);
      showToast("Goal removed", "info");
      refreshData();
    } catch {
      showToast("Failed to remove goal", "error");
    }
  };

  const accountOptions = accounts.map((a) => ({
    value: a.id,
    label: `${a.name} (${formatIndianCurrency(a.balance)})`,
  }));

  const totalGoalTarget = goals.reduce((s, g) => s + Number(g.target_amount), 0);
  const totalGoalCurrent = goals.reduce((s, g) => s + Number(g.current_amount), 0);
  const completedCount = goals.filter((g) => Number(g.current_amount) >= Number(g.target_amount)).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div>
          <h2 className="text-2xl md:text-3xl font-extrabold m-0 text-foreground">
            Goals
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            Track targeted milestones and allocate savings
          </p>
        </div>
        <button
          onClick={() => setIsAddGoalOpen(true)}
          className="btn-gold flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Add New Goal
        </button>
      </div>

      {/* Summary stats */}
      {goals.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="glass-card rounded-2xl p-4 border border-border">
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">Saved So Far</p>
            <p className="text-lg font-bold text-foreground mt-1 truncate">{formatIndianCurrency(totalGoalCurrent)}</p>
          </div>
          <div className="glass-card rounded-2xl p-4 border border-border">
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">Total Target</p>
            <p className="text-lg font-bold text-foreground mt-1 truncate">{formatIndianCurrency(totalGoalTarget)}</p>
          </div>
          <div className="glass-card rounded-2xl p-4 border border-border">
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">Completed</p>
            <p className="text-lg font-bold text-emerald-400 mt-1">{completedCount} / {goals.length}</p>
          </div>
          <div className="glass-card rounded-2xl p-4 border border-gold-500/20 bg-gold-500/[0.03]">
            <p className="text-[11px] text-gold-400 dark:text-gold-300 uppercase tracking-wider font-semibold">Monthly Surplus</p>
            <p className="text-lg font-bold text-foreground mt-1 truncate">{formatIndianCurrency(monthlySurplus)}</p>
          </div>
        </div>
      )}

      {/* Goal cards */}
      {goals.length === 0 ? (
        <div className="glass-card rounded-2xl py-16 px-6 text-center border border-border space-y-3">
          <Target className="w-10 h-10 mx-auto text-muted-foreground/40" />
          <p className="text-foreground font-semibold">No goals yet</p>
          <p className="text-muted-foreground text-sm max-w-xs mx-auto">
            Create a savings goal — an emergency fund, a trip, a gadget — and track your progress toward it every month.
          </p>
          <button
            onClick={() => setIsAddGoalOpen(true)}
            className="btn-gold inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm cursor-pointer mt-2"
          >
            <Plus className="w-4 h-4" />
            Create Your First Goal
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {goals.map((g) => {
            const cur = Number(g.current_amount);
            const tar = Number(g.target_amount);
            const remaining = Math.max(0, tar - cur);
            const isCompleted = cur >= tar;
            const progress = tar > 0 ? (cur / tar) * 100 : 0;
            const radius = 36;
            const circumference = 2 * Math.PI * radius;
            const strokeDashoffset =
              circumference - (Math.min(100, progress) / 100) * circumference;

            let daysToCompletionStr = "Accumulate surplus";
            if (isCompleted) {
              daysToCompletionStr = "Completed! 🎉";
            } else if (goalAllocation > 0) {
              const months = remaining / goalAllocation;
              const days = Math.round(months * 30.4);
              daysToCompletionStr = `~${days} days remaining (${months.toFixed(1)} months)`;
            }

            const goalIcon = loadIcon(g.id);
            const sip = loadSip(g.id);
            const sipAccount = sip
              ? accounts.find((a) => a.id === sip.accountId)
              : null;

            return (
              <div
                key={g.id}
                className="glass-card rounded-2xl p-6 border border-border flex flex-col justify-between space-y-6 relative overflow-hidden group"
              >
                {/* Background overlay */}
                {goalBgImages[g.id] && (
                  <>
                    <img
                      src={goalBgImages[g.id]}
                      className="absolute inset-0 w-full h-full object-cover opacity-45 dark:opacity-35 group-hover:scale-105 transition-transform duration-500 pointer-events-none"
                      alt=""
                    />
                    <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-background/40 to-background/95 pointer-events-none" />
                  </>
                )}

                {/* Card header */}
                <div className="flex justify-between items-start gap-4 relative z-10">
                  <div className="min-w-0">
                    <h4 className="text-lg font-bold text-foreground m-0 truncate flex items-center gap-1.5">
                      {goalIcon && (
                        <span className="text-xl shrink-0">{goalIcon}</span>
                      )}
                      {g.name}
                      {isCompleted && (
                        <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                      )}
                    </h4>
                    <span className="text-xs text-muted-foreground mt-1 block">
                      Target: {formatIndianCurrency(tar, false)}
                    </span>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => setEditingGoal(g)}
                      className="w-9 h-9 flex items-center justify-center text-muted-foreground hover:text-gold-400 hover:bg-gold-400/10 rounded-lg transition-colors cursor-pointer"
                      title="Edit Goal"
                      aria-label="Edit goal"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteGoal(g.id)}
                      className="w-9 h-9 flex items-center justify-center text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                      title="Delete Goal"
                      aria-label="Delete goal"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Auto-contribution badge (#8) */}
                {sip && sip.monthlyAmount > 0 && (
                  <div className="relative z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-500/10 border border-violet-500/20 w-fit">
                    <RefreshCw className="w-3 h-3 text-violet-400 shrink-0" />
                    <span className="text-[11px] font-semibold text-violet-300">
                      {formatIndianCurrency(sip.monthlyAmount)}/mo on {sip.day}
                      {Number(sip.day) === 1
                        ? "st"
                        : Number(sip.day) === 2
                          ? "nd"
                          : Number(sip.day) === 3
                            ? "rd"
                            : "th"}
                      {sipAccount ? ` · ${sipAccount.name}` : ""}
                    </span>
                  </div>
                )}

                {/* Progress circle */}
                <div className="flex items-center gap-5 bg-card/70 backdrop-blur-md p-4 rounded-xl border border-border/70 relative z-10 shadow-sm">
                  <div className="relative w-20 h-20 shrink-0 flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90">
                      <circle
                        cx="40"
                        cy="40"
                        r={radius}
                        className="stroke-muted fill-none"
                        strokeWidth="5"
                      />
                      <circle
                        cx="40"
                        cy="40"
                        r={radius}
                        className="stroke-violet-500 fill-none transition-all duration-1000"
                        strokeWidth="5"
                        strokeDasharray={circumference}
                        strokeDashoffset={strokeDashoffset}
                        strokeLinecap="round"
                      />
                    </svg>
                    <span className="absolute text-xs font-black text-foreground">
                      {progress.toFixed(0)}%
                    </span>
                  </div>

                  <div className="space-y-1 min-w-0 flex-1">
                    <span className="text-muted-foreground text-[10px] uppercase font-bold block">
                      Current Balance
                    </span>
                    <span className="text-lg font-extrabold text-foreground block">
                      {formatIndianCurrency(cur)}
                    </span>
                    {!isCompleted && (
                      <span className="text-[11px] text-muted-foreground block truncate">
                        {formatIndianCurrency(remaining)} to go
                      </span>
                    )}
                    <span className="text-[11px] font-medium text-gold-400 dark:text-gold-400 block truncate">
                      {daysToCompletionStr}
                    </span>
                  </div>
                </div>

                {/* Linear progress bar — quick-glance status alongside the ring */}
                <div className="relative z-10 h-1.5 w-full bg-muted rounded-full overflow-hidden -mt-3">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${isCompleted ? "bg-emerald-500" : "bg-violet-500"}`}
                    style={{ width: `${Math.min(100, progress)}%` }}
                  />
                </div>

                {!isCompleted ? (
                  <button
                    onClick={() => {
                      setSelectedGoal(g);
                      setIsAddFundsOpen(true);
                    }}
                    className="w-full bg-muted hover:bg-gold-500 border border-border text-foreground hover:text-white font-semibold py-2.5 min-h-[44px] rounded-xl transition-all flex items-center justify-center gap-1.5 text-xs hover:shadow-lg hover:shadow-violet-600/20 relative z-10 cursor-pointer"
                  >
                    <Coins className="w-4 h-4" />
                    Allocate Funds
                  </button>
                ) : (
                  <div className="py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 font-bold text-center text-xs flex items-center justify-center gap-1 relative z-10">
                    <Sparkles className="w-4 h-4 text-emerald-500 animate-pulse" />{" "}
                    Milestones Reached!
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Add Goal Modal ── */}
      <Modal
        isOpen={isAddGoalOpen}
        onClose={() => setIsAddGoalOpen(false)}
        title="Create Financial Goal"
      >
        <form onSubmit={handleAddGoal} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
              Goal Name
            </label>
            <input
              type="text"
              placeholder="e.g. Emergency Fund, GPU Fund"
              value={newGoalName}
              onChange={(e) => setNewGoalName(e.target.value)}
              className="w-full bg-background border border-border rounded-xl min-h-[48px] py-3 px-3.5 text-foreground text-sm focus:outline-none focus:border-gold-500"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <NumberInput
              label="Target Amount (₹)"
              value={newGoalTarget || ""}
              onChange={setNewGoalTarget}
              prefix="₹"
              placeholder="15000"
              decimals={false}
            />
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                Target Date (Optional)
              </label>
              <input
                type="date"
                value={newGoalDeadline}
                onChange={(e) => setNewGoalDeadline(e.target.value)}
                className="w-full bg-background border border-border rounded-xl min-h-[48px] py-3 px-3.5 text-foreground text-sm focus:outline-none focus:border-gold-500"
              />
            </div>
          </div>

          {/* #9 — Icon picker */}
          <GoalIconPicker value={newGoalIcon} onChange={setNewGoalIcon} />

          {/* Background image */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
              Background Image URL
            </label>
            <input
              type="text"
              placeholder="Paste image URL (e.g. from Unsplash) or choose preset below"
              value={newGoalBgUrl}
              onChange={(e) => setNewGoalBgUrl(e.target.value)}
              className="w-full bg-background border border-border rounded-xl min-h-[48px] py-3 px-3.5 text-foreground text-sm focus:outline-none focus:border-gold-500 mb-2"
            />
            <div className="flex gap-2 items-center flex-wrap">
              {PRESET_GOAL_BGS.map((bg, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setNewGoalBgUrl(bg.url)}
                  className={`px-2 py-1 rounded-lg bg-muted text-[10px] font-bold text-muted-foreground border hover:text-foreground border-border ${newGoalBgUrl === bg.url
                      ? "border-violet-600 text-gold-400 dark:text-gold-300"
                      : "border-transparent"
                    }`}
                >
                  {bg.name}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setNewGoalBgUrl("")}
                className={`px-2 py-1 rounded-lg bg-muted text-[10px] font-bold text-muted-foreground border border-border hover:text-foreground ${!newGoalBgUrl ? "border-violet-600" : "border-transparent"
                  }`}
              >
                No Image
              </button>
              <input
                type="file"
                ref={goalBgInputRef}
                accept="image/*"
                onChange={handleGoalBgUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => goalBgInputRef.current?.click()}
                disabled={uploadingGoalBg}
                className="px-2 py-1 rounded-lg bg-muted text-[10px] font-bold text-muted-foreground border border-border hover:text-foreground border-transparent flex items-center gap-1 transition-all"
              >
                <Upload className="w-3 h-3 text-gold-400" />
                {uploadingGoalBg ? "Compressing..." : "Upload File"}
              </button>
            </div>
          </div>

          {/* #8 — Auto-contribution */}
          <AutoContributionSection
            sipEnabled={newSipEnabled}
            setSipEnabled={setNewSipEnabled}
            sipAmount={newSipAmount}
            setSipAmount={setNewSipAmount}
            sipDay={newSipDay}
            setSipDay={setNewSipDay}
            sipAccountId={newSipAccountId}
            setSipAccountId={setNewSipAccountId}
            accounts={accounts}
            fmt={formatIndianCurrency}
          />

          <div className="flex gap-3 mt-6 pt-4 border-t border-border">
            <button
              type="button"
              onClick={() => setIsAddGoalOpen(false)}
              className="flex-1 bg-muted hover:bg-muted/80 border border-border text-foreground font-semibold py-3 rounded-xl transition-all text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 bg-gold-500 hover:bg-gold-600 text-white font-semibold py-3 rounded-xl transition-all shadow-lg hover:shadow-gold-500/30 text-sm"
            >
              Create Goal
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Edit Goal Modal ── */}
      <Modal
        isOpen={editingGoal !== null}
        onClose={() => setEditingGoal(null)}
        title="Edit Financial Goal"
      >
        {editingGoal && (
          <EditGoalForm
            goal={editingGoal}
            onClose={() => setEditingGoal(null)}
            goalBgImages={goalBgImages}
            updateGoalBgImage={updateGoalBgImage}
            showToast={showToast}
            refreshData={refreshData}
            accounts={accounts}
            fmt={formatIndianCurrency}
          />
        )}
      </Modal>

      {/* ── Add Funds Modal ── */}
      <Modal
        isOpen={isAddFundsOpen}
        onClose={() => setIsAddFundsOpen(false)}
        title={`Allocate Funds to ${selectedGoal?.name}`}
      >
        <form onSubmit={handleAddFunds} className="space-y-4">
          <div>
            <NumberInput
              label="Allocation Amount (₹)"
              value={fundAmount || ""}
              onChange={setFundAmount}
              prefix="₹"
              placeholder="5000"
              decimals={false}
            />
            {selectedGoal && (
              <span className="text-[10px] text-muted-foreground mt-1 block">
                Remaining target:{" "}
                {formatIndianCurrency(
                  Number(selectedGoal.target_amount) -
                  Number(selectedGoal.current_amount)
                )}
              </span>
            )}
          </div>

          <CustomSelect
            label="Source Account"
            options={accountOptions}
            value={fundSourceAccount}
            onChange={setFundSourceAccount}
            placeholder="Select Account"
          />

          <div className="flex gap-3 mt-6 pt-4 border-t border-border">
            <button
              type="button"
              onClick={() => setIsAddFundsOpen(false)}
              className="flex-1 bg-muted hover:bg-muted/80 border border-border text-foreground font-semibold py-3 rounded-xl transition-all text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 bg-gold-500 hover:bg-gold-600 text-white font-semibold py-3 rounded-xl transition-all shadow-lg hover:shadow-gold-500/30 text-sm"
            >
              Allocate
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
