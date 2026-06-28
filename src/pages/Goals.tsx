import React, { useState, useRef } from "react";
import { useApp } from "../context/AppContext";
import { compressImage } from "../lib/utils";
import { addGoal, updateGoal, deleteGoal, updateAccountBalance } from "../lib/db";
import { 
  Plus, 
  Coins, 
  Trash2, 
  Edit2,
  CheckCircle,
  Sparkles,
  Upload
} from "lucide-react";
import { Modal } from "../components/Modal";
import confetti from "canvas-confetti";
import type { Goal } from "../lib/db";

export const Goals: React.FC = () => {
  const { goals, accounts, profile, emis, transactions, showToast, refreshData, goalBgImages, updateGoalBgImage, fmt: formatIndianCurrency } = useApp();
  const [isAddGoalOpen, setIsAddGoalOpen] = useState(false);
  const [isAddFundsOpen, setIsAddFundsOpen] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<any | null>(null);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  
  // Add Funds form fields
  const [fundAmount, setFundAmount] = useState("");
  const [fundSourceAccount, setFundSourceAccount] = useState("");

  // Goal Form Fields
  const [newGoalName, setNewGoalName] = useState("");
  const [newGoalTarget, setNewGoalTarget] = useState("");
  const [newGoalDeadline, setNewGoalDeadline] = useState("");
  const [newGoalBgUrl, setNewGoalBgUrl] = useState("");
  const [uploadingGoalBg, setUploadingGoalBg] = useState(false);
  const goalBgInputRef = useRef<HTMLInputElement>(null);

  const handleGoalBgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingGoalBg(true);
    try {
      const base64Data = await compressImage(file, 800, 600, 0.7);
      setNewGoalBgUrl(base64Data);
      showToast("Background image compressed & loaded!", "success");
    } catch (err) {
      showToast("Failed to parse background image file", "error");
    } finally {
      setUploadingGoalBg(false);
    }
  };

  const PRESET_GOAL_BGS = [
    { name: "Emergency 🛡️", url: "https://images.unsplash.com/photo-1579621970795-87faff3f0768?auto=format&fit=crop&w=400&q=80" },
    { name: "House 🏠", url: "https://images.unsplash.com/photo-1570129477492-45c003edd2be?auto=format&fit=crop&w=400&q=80" },
    { name: "Car/Bike 🚗", url: "https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=400&q=80" },
    { name: "Gadgets 💻", url: "https://images.unsplash.com/photo-1591488320449-011701bb6704?auto=format&fit=crop&w=400&q=80" },
    { name: "Travel ✈️", url: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=400&q=80" },
    { name: "Education 🎓", url: "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&w=400&q=80" },
  ];

  // Calculate monthly allocation for goals
  const monthlySalary = profile ? Number(profile.monthly_salary) : 20000;
  
  const now = new Date();
  const currentMonthTxs = transactions.filter(t => {
    const d = new Date(t.date);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  });
  
  const monthlyExpense = currentMonthTxs
    .filter(t => t.type === "expense" && !t.category.includes("EMI"))
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const totalMonthlyEmi = emis.reduce((sum, e) => sum + Number(e.emi_amount), 0);
  const monthlySurplus = Math.max(0, monthlySalary - monthlyExpense - totalMonthlyEmi);

  const activeGoals = goals.filter(g => Number(g.current_amount) < Number(g.target_amount));
  const goalAllocation = activeGoals.length > 0 ? (monthlySurplus > 0 ? monthlySurplus : 1000) / activeGoals.length : 1000;

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

      showToast("Goal created successfully", "success");
      setNewGoalName("");
      setNewGoalTarget("");
      setNewGoalDeadline("");
      setNewGoalBgUrl("");
      setIsAddGoalOpen(false);
      refreshData();
    } catch (err) {
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

    const account = accounts.find(a => a.id === fundSourceAccount);
    if (!account) return;

    if (account.balance < amt) {
      showToast(`Insufficient balance in ${account.name}`, "error");
      return;
    }

    try {
      const nextAmount = Number(selectedGoal.current_amount) + amt;
      const target = Number(selectedGoal.target_amount);

      await updateAccountBalance(account.id, -amt);

      await updateGoal({
        id: selectedGoal.id,
        current_amount: nextAmount,
      });

      if (nextAmount >= target) {
        confetti({
          particleCount: 150,
          spread: 85,
          origin: { y: 0.6 }
        });
        showToast(`🎉 Goal Complete! Reached ${selectedGoal.name}!`, "success");
      } else {
        showToast(`Added ${formatIndianCurrency(amt)} to ${selectedGoal.name}`, "success");
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
      showToast("Goal removed", "info");
      refreshData();
    } catch (err) {
      showToast("Failed to remove goal", "error");
    }
  };

  // Edit Goal Form Component
  const EditGoalForm: React.FC<{ goal: Goal; onClose: () => void }> = ({ goal, onClose }) => {
    const [name, setName] = useState(goal.name);
    const [target, setTarget] = useState(goal.target_amount.toString());
    const [current, setCurrent] = useState(goal.current_amount.toString());
    const [deadline, setDeadline] = useState(goal.deadline ? goal.deadline.split("T")[0] : "");
    const [bgUrl, setBgUrl] = useState(goalBgImages[goal.id] || "");
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setUploading(true);
      try {
        const base64Data = await compressImage(file, 800, 600, 0.7);
        setBgUrl(base64Data);
        showToast("Background image compressed & loaded!", "success");
      } catch (err) {
        showToast("Failed to parse image file", "error");
      } finally {
        setUploading(false);
      }
    };

    const handleEditGoalSubmit = async (e: React.FormEvent) => {
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
          deadline: deadline || null
        });
        updateGoalBgImage(goal.id, bgUrl);
        showToast("Goal updated successfully", "success");
        refreshData();
        onClose();
      } catch (err) {
        showToast("Failed to update goal", "error");
      }
    };

    return (
      <form onSubmit={handleEditGoalSubmit} className="space-y-4">
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Goal Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-background border border-border rounded-xl py-2.5 px-3 text-foreground text-sm focus:outline-none focus:border-gold-500"
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Target (₹)</label>
            <input
              type="number"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="w-full bg-background border border-border rounded-xl py-2.5 px-3 text-foreground text-sm focus:outline-none focus:border-gold-500"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Current (₹)</label>
            <input
              type="number"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              className="w-full bg-background border border-border rounded-xl py-2.5 px-3 text-foreground text-sm focus:outline-none focus:border-gold-500"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Target Date</label>
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="w-full bg-background border border-border rounded-xl py-2.5 px-3 text-foreground text-sm focus:outline-none focus:border-gold-500"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Background Image URL</label>
          <input
            type="text"
            placeholder="Paste avatar URL or select preset below"
            value={bgUrl}
            onChange={(e) => setBgUrl(e.target.value)}
            className="w-full bg-background border border-border rounded-xl py-2.5 px-3 text-foreground text-sm focus:outline-none focus:border-gold-500 mb-2"
          />
          <div className="flex gap-2 items-center flex-wrap">
            {PRESET_GOAL_BGS.map((bg, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setBgUrl(bg.url)}
                className={`px-2 py-1 rounded-lg bg-muted text-[10px] font-bold text-muted-foreground border hover:text-foreground border-border ${bgUrl === bg.url ? "border-violet-600 text-gold-400 dark:text-gold-300" : "border-transparent"}`}
              >
                {bg.name.split(" ")[0]}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setBgUrl("")}
              className={`px-2 py-1 rounded-lg bg-muted text-[10px] font-bold text-muted-foreground border border-border hover:text-foreground ${!bgUrl ? "border-violet-600" : "border-transparent"}`}
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

        <div className="flex gap-3 mt-6 pt-4 border-t border-border">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 bg-muted hover:bg-muted/80 border border-border text-foreground font-semibold py-2.5 rounded-xl transition-all text-sm"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="flex-1 bg-gold-500 hover:bg-gold-600 text-white font-semibold py-2.5 rounded-xl transition-all shadow-lg hover:shadow-gold-500/30 text-sm"
          >
            Save Changes
          </button>
        </div>
      </form>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl md:text-3xl font-extrabold m-0 text-foreground">Goals</h2>
          <p className="text-muted-foreground text-sm mt-1">Track targeted milestones and allocate savings</p>
        </div>
        <button
          onClick={() => setIsAddGoalOpen(true)}
          className="btn-gold flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Add New Goal
        </button>
      </div>

      {/* Target allocation header details */}
      <div className="p-4 rounded-xl bg-violet-950/10 border border-gold-500/12 flex items-center justify-between text-xs md:text-sm">
        <span className="text-gold-400 dark:text-gold-300">
          Current Monthly Surplus for Goals: <strong className="text-foreground">{formatIndianCurrency(monthlySurplus)}</strong>
        </span>
        <span className="text-muted-foreground">
          Estimated: <strong className="text-gold-400 dark:text-gold-400">{formatIndianCurrency(goalAllocation)}</strong> per goal / month
        </span>
      </div>

      {/* Grid of Goal cards */}
      {goals.length === 0 ? (
        <div className="glass-card rounded-2xl py-16 text-center text-muted-foreground border border-border">
          No goals established yet. Create one above.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {goals.map((g) => {
            const cur = Number(g.current_amount);
            const tar = Number(g.target_amount);
            const remaining = Math.max(0, tar - cur);
            const isCompleted = cur >= tar;
            const progress = tar > 0 ? (cur / tar) * 100 : 0;

            let daysToCompletionStr = "Accumulate surplus";
            if (isCompleted) {
              daysToCompletionStr = "Completed! 🎉";
            } else if (goalAllocation > 0) {
              const months = remaining / goalAllocation;
              const days = Math.round(months * 30.4);
              daysToCompletionStr = `~${days} days remaining (${months.toFixed(1)} months)`;
            }

            const radius = 36;
            const circumference = 2 * Math.PI * radius;
            const strokeDashoffset = circumference - (Math.min(100, progress) / 100) * circumference;

            return (
              <div key={g.id} className="glass-card rounded-2xl p-6 border border-border flex flex-col justify-between space-y-6 relative overflow-hidden group">
                {/* Background Image overlay */}
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

                <div className="flex justify-between items-start gap-4 relative z-10">
                  <div className="min-w-0">
                    <h4 className="text-lg font-bold text-foreground m-0 truncate flex items-center gap-1.5">
                      {g.name}
                      {isCompleted && <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />}
                    </h4>
                    <span className="text-xs text-muted-foreground mt-1 block">
                      Target: {formatIndianCurrency(tar, false)}
                    </span>
                  </div>
                  <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => setEditingGoal(g)}
                      className="p-1 text-muted-foreground hover:text-gold-400 hover:bg-gold-400/10 rounded-lg transition-colors"
                      title="Edit Goal"
                    >
                      <Edit2 className="w-4.5 h-4.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteGoal(g.id)}
                      className="p-1 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors"
                      title="Delete Goal"
                    >
                      <Trash2 className="w-4.5 h-4.5" />
                    </button>
                  </div>
                </div>

                {/* Progress Circle & Text Row */}
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

                  <div className="space-y-1 min-w-0">
                    <span className="text-muted-foreground text-[10px] uppercase font-bold block">Current Balance</span>
                    <span className="text-lg font-extrabold text-foreground block">
                      {formatIndianCurrency(cur)}
                    </span>
                    <span className="text-[11px] font-medium text-gold-400 dark:text-gold-400 block truncate">
                      {daysToCompletionStr}
                    </span>
                  </div>
                </div>

                {!isCompleted ? (
                  <button
                    onClick={() => {
                      setSelectedGoal(g);
                      setIsAddFundsOpen(true);
                    }}
                    className="w-full bg-muted hover:bg-gold-500 border border-border text-foreground hover:text-white font-semibold py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 text-xs hover:shadow-lg hover:shadow-violet-600/20 relative z-10"
                  >
                    <Coins className="w-4 h-4" />
                    Allocate Funds
                  </button>
                ) : (
                  <div className="py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 font-bold text-center text-xs flex items-center justify-center gap-1 relative z-10">
                    <Sparkles className="w-4 h-4 text-emerald-500 animate-pulse" /> Milestones Reached!
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add Goal Modal */}
      <Modal isOpen={isAddGoalOpen} onClose={() => setIsAddGoalOpen(false)} title="Create Financial Goal">
        <form onSubmit={handleAddGoal} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Goal Name</label>
            <input
              type="text"
              placeholder="e.g. Emergency Fund, GPU Fund"
              value={newGoalName}
              onChange={(e) => setNewGoalName(e.target.value)}
              className="w-full bg-background border border-border rounded-xl py-2.5 px-3 text-foreground text-sm focus:outline-none focus:border-gold-500"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Target Amount (₹)</label>
              <input
                type="number"
                placeholder="15,000"
                value={newGoalTarget}
                onChange={(e) => setNewGoalTarget(e.target.value)}
                className="w-full bg-background border border-border rounded-xl py-2.5 px-3 text-foreground text-sm focus:outline-none focus:border-gold-500"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Target Date (Optional)</label>
              <input
                type="date"
                value={newGoalDeadline}
                onChange={(e) => setNewGoalDeadline(e.target.value)}
                className="w-full bg-background border border-border rounded-xl py-2.5 px-3 text-foreground text-sm focus:outline-none focus:border-gold-500"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Background Image URL</label>
            <input
              type="text"
              placeholder="Paste image URL (e.g. from Unsplash) or choose preset below"
              value={newGoalBgUrl}
              onChange={(e) => setNewGoalBgUrl(e.target.value)}
              className="w-full bg-background border border-border rounded-xl py-2.5 px-3 text-foreground text-sm focus:outline-none focus:border-gold-500 mb-2"
            />
            <div className="flex gap-2 items-center flex-wrap">
              {PRESET_GOAL_BGS.map((bg, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setNewGoalBgUrl(bg.url)}
                  className={`px-2 py-1 rounded-lg bg-muted text-[10px] font-bold text-muted-foreground border hover:text-foreground border-border ${newGoalBgUrl === bg.url ? "border-violet-600 text-gold-400 dark:text-gold-300" : "border-transparent"}`}
                >
                  {bg.name}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setNewGoalBgUrl("")}
                className={`px-2 py-1 rounded-lg bg-muted text-[10px] font-bold text-muted-foreground border border-border hover:text-foreground ${!newGoalBgUrl ? "border-violet-600" : "border-transparent"}`}
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

          <div className="flex gap-3 mt-6 pt-4 border-t border-border">
            <button
              type="button"
              onClick={() => setIsAddGoalOpen(false)}
              className="flex-1 bg-muted hover:bg-muted/80 border border-border text-foreground font-semibold py-2.5 rounded-xl transition-all text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 bg-gold-500 hover:bg-gold-600 text-white font-semibold py-2.5 rounded-xl transition-all shadow-lg hover:shadow-gold-500/30 text-sm"
            >
              Create Goal
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Goal Modal */}
      <Modal isOpen={editingGoal !== null} onClose={() => setEditingGoal(null)} title="Edit Financial Goal">
        {editingGoal && (
          <EditGoalForm goal={editingGoal} onClose={() => setEditingGoal(null)} />
        )}
      </Modal>

      {/* Add Funds Modal */}
      <Modal isOpen={isAddFundsOpen} onClose={() => setIsAddFundsOpen(false)} title={`Allocate Funds to ${selectedGoal?.name}`}>
        <form onSubmit={handleAddFunds} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Allocation Amount (₹)</label>
            <input
              type="number"
              placeholder="5,000"
              value={fundAmount}
              onChange={(e) => setFundAmount(e.target.value)}
              className="w-full bg-background border border-border rounded-xl py-2.5 px-3 text-foreground text-sm focus:outline-none focus:border-gold-500"
            />
            {selectedGoal && (
              <span className="text-[10px] text-muted-foreground mt-1 block">
                Remaining target: {formatIndianCurrency(Number(selectedGoal.target_amount) - Number(selectedGoal.current_amount))}
              </span>
            )}
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Source Account</label>
            <select
              value={fundSourceAccount}
              onChange={(e) => setFundSourceAccount(e.target.value)}
              className="w-full bg-background border border-border rounded-xl py-2.5 px-3 text-foreground text-sm focus:outline-none focus:border-gold-500"
            >
              <option value="">Select Account</option>
              {accounts.map(acc => (
                <option key={acc.id} value={acc.id}>
                  {acc.name} ({formatIndianCurrency(acc.balance)})
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-3 mt-6 pt-4 border-t border-border">
            <button
              type="button"
              onClick={() => setIsAddFundsOpen(false)}
              className="flex-1 bg-muted hover:bg-muted/80 border border-border text-foreground font-semibold py-2.5 rounded-xl transition-all text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 bg-gold-500 hover:bg-gold-600 text-white font-semibold py-2.5 rounded-xl transition-all shadow-lg hover:shadow-gold-500/30 text-sm"
            >
              Allocate
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
