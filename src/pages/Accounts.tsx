import React, { useState } from "react";
import { useApp } from "../context/AppContext";
import { addAccount, deleteAccount, updateAccount } from "../lib/db";
import {
  Plus,
  Trash2,
  Edit2,
  Star,
  Wallet,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  TrendingDown,
  Info,
  Calendar,
  CreditCard,
  Landmark,
  Building2,
  Briefcase,
  Banknote,
} from "lucide-react";
import { Modal } from "../components/Modal";
import { CustomSelect, NumberInput } from "../components/CustomSelect";
import type { Account } from "../lib/db";

// ── Account type config ──────────────────────────────────────────────────────
const ACCOUNT_TYPE_CONFIG: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  savings:  { icon: <Landmark  className="w-4 h-4" />, color: "text-blue-400 bg-blue-500/10 border-blue-500/20",    label: "Savings"      },
  current:  { icon: <Building2 className="w-4 h-4" />, color: "text-violet-400 bg-violet-500/10 border-violet-500/20", label: "Current"   },
  business: { icon: <Briefcase className="w-4 h-4" />, color: "text-amber-400 bg-amber-500/10 border-amber-500/20",  label: "Business"    },
  cash:     { icon: <Banknote  className="w-4 h-4" />, color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20", label: "Cash"  },
  wallet:   { icon: <Wallet    className="w-4 h-4" />, color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",    label: "Wallet"       },
  credit:   { icon: <CreditCard className="w-4 h-4" />, color: "text-rose-400 bg-rose-500/10 border-rose-500/20",  label: "Credit Card"  },
};

const CREDIT_LIMIT_KEY = (id: string) => `credit_limit_${id}`;

function getCreditLimit(id: string): number {
  return Number(localStorage.getItem(CREDIT_LIMIT_KEY(id)) || "0");
}
function setCreditLimit(id: string, value: number) {
  localStorage.setItem(CREDIT_LIMIT_KEY(id), String(value));
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function getTypeConfig(type: string) {
  return ACCOUNT_TYPE_CONFIG[type] ?? {
    icon: <Wallet className="w-4 h-4" />,
    color: "text-gold-400 bg-gold-500/10 border-gold-500/20",
    label: type.charAt(0).toUpperCase() + type.slice(1),
  };
}

// ── Main Component ───────────────────────────────────────────────────────────
export const Accounts: React.FC = () => {
  const {
    accounts,
    transactions,
    profile,
    starredAccountIds,
    toggleStarAccount,
    showToast,
    refreshData,
    customAccountTypes,
    addCustomAccountType,
    fmt: formatIndianCurrency,
  } = useApp();

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);

  // Form states for Add Account
  const [newAccName, setNewAccName] = useState("");
  const [newAccType, setNewAccType] = useState("savings");
  const [newAccBalance, setNewAccBalance] = useState<string>("");
  const [newCreditLimit, setNewCreditLimit] = useState<string>("");
  const [customTypeName, setCustomTypeName] = useState("");
  const [addingAcc, setAddingAcc] = useState(false);

  // Calculations
  const totalBalance = accounts.reduce((sum, a) => sum + Number(a.balance), 0);

  // Account type options for CustomSelect
  const accountTypeOptions = (types: string[]) => [
    { value: "savings",  label: "Savings Account",  icon: <Landmark  className="w-4 h-4" /> },
    { value: "current",  label: "Current Account",  icon: <Building2 className="w-4 h-4" /> },
    { value: "business", label: "Business Account", icon: <Briefcase className="w-4 h-4" /> },
    { value: "cash",     label: "Cash / Wallet",    icon: <Banknote  className="w-4 h-4" /> },
    { value: "wallet",   label: "Digital Wallet",   icon: <Wallet    className="w-4 h-4" /> },
    { value: "credit",   label: "Credit Card",      icon: <CreditCard className="w-4 h-4" /> },
    ...types.map(t => ({ value: t, label: t.charAt(0).toUpperCase() + t.slice(1), icon: null as React.ReactNode })),
    { value: "__custom__", label: "+ Add Custom Type", icon: null as React.ReactNode },
  ];

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccName || newAccBalance === "") {
      showToast("Please fill in account name and opening balance", "warning");
      return;
    }

    setAddingAcc(true);
    try {
      let finalType = newAccType;
      if (newAccType === "__custom__") {
        if (!customTypeName.trim()) {
          showToast("Please enter custom account type", "warning");
          setAddingAcc(false);
          return;
        }
        finalType = customTypeName.trim().toLowerCase();
        addCustomAccountType(finalType);
      }

      const newAcc = await addAccount({
        user_id: profile!.id,
        name: newAccName,
        type: finalType,
        balance: Number(newAccBalance),
      });

      // Save credit limit if credit card
      if (finalType === "credit" && newCreditLimit && newAcc?.id) {
        setCreditLimit(newAcc.id, Number(newCreditLimit));
      }

      showToast("Account created successfully", "success");
      setNewAccName("");
      setNewAccBalance("");
      setNewCreditLimit("");
      setCustomTypeName("");
      setNewAccType("savings");
      setIsAddOpen(false);
      refreshData();
    } catch (err) {
      showToast("Failed to create account", "error");
    } finally {
      setAddingAcc(false);
    }
  };

  const handleDeleteAccount = async (id: string) => {
    if (accounts.length <= 1) {
      showToast("You must keep at least one account node", "warning");
      return;
    }
    const acc = accounts.find(a => a.id === id);
    if (!acc) return;
    if (!window.confirm(`Are you sure you want to delete ${acc.name}? Deleting this account will not erase transaction histories but will disrupt net worth tracking.`)) return;

    try {
      await deleteAccount(id);
      showToast("Account node removed", "info");
      refreshData();
    } catch (err) {
      showToast("Failed to delete account", "error");
    }
  };

  // ── Edit Account Form ──────────────────────────────────────────────────────
  const EditAccountForm: React.FC<{ account: Account; onClose: () => void }> = ({ account, onClose }) => {
    const [name, setName] = useState(account.name);
    const [type, setType] = useState(account.type);
    const [editCustomTypeName, setEditCustomTypeName] = useState("");
    const [creditLimit, setCreditLimitState] = useState<string>(String(getCreditLimit(account.id) || ""));
    const [saving, setSaving] = useState(false);

    const handleEditAccountSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!name) {
        showToast("Please fill in account name", "warning");
        return;
      }

      setSaving(true);
      try {
        let finalType = type;
        if (type === "__custom__") {
          if (!editCustomTypeName.trim()) {
            showToast("Please enter custom account type", "warning");
            setSaving(false);
            return;
          }
          finalType = editCustomTypeName.trim().toLowerCase();
          addCustomAccountType(finalType);
        }

        await updateAccount({
          id: account.id,
          name,
          type: finalType,
        });

        // Save credit limit
        if (finalType === "credit" && creditLimit !== "") {
          setCreditLimit(account.id, Number(creditLimit));
        }

        showToast("Account updated successfully", "success");
        refreshData();
        onClose();
      } catch (err) {
        showToast("Failed to update account", "error");
      } finally {
        setSaving(false);
      }
    };

    return (
      <form onSubmit={handleEditAccountSubmit} className="space-y-4">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Account Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-background border border-border rounded-xl min-h-[48px] py-3 px-3.5 text-foreground text-sm focus:outline-none focus:border-gold-500"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <CustomSelect
            label="Account Type"
            options={accountTypeOptions(customAccountTypes)}
            value={type}
            onChange={setType}
          />

          <div>
            <label className="text-xs text-muted-foreground block mb-1">Current Balance (₹)</label>
            <input
              type="number"
              step="any"
              value={account.balance}
              readOnly
              disabled
              className="w-full bg-muted/30 border border-border rounded-xl min-h-[48px] py-3 px-3.5 text-muted-foreground text-sm cursor-not-allowed opacity-60"
            />
            <p className="text-[10px] text-muted-foreground mt-1">Auto-calculated from transactions</p>
          </div>
        </div>

        {type === "__custom__" && (
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Custom Account Type Name</label>
            <input
              type="text"
              placeholder="e.g. Wallet, Post Office, Chit Fund"
              value={editCustomTypeName}
              onChange={(e) => setEditCustomTypeName(e.target.value)}
              className="w-full bg-background border border-border rounded-xl min-h-[48px] py-3 px-3.5 text-foreground text-sm focus:outline-none focus:border-gold-500"
            />
          </div>
        )}

        {(type === "credit") && (
          <NumberInput
            label="Credit Limit (₹)"
            value={creditLimit}
            onChange={v => setCreditLimitState(v)}
            decimals={true}
            prefix="₹"
            placeholder="e.g. 50000"
          />
        )}

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
            disabled={saving}
            className="flex-1 bg-gold-500 hover:bg-violet-750 text-white font-semibold py-2.5 rounded-xl transition-all shadow-lg hover:shadow-gold-500/30 text-sm"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl md:text-3xl font-extrabold m-0 text-foreground">Account Nodes</h2>
          <p className="text-muted-foreground text-sm mt-1">Audit and star your banking and cash storage endpoints</p>
        </div>
        <button
          onClick={() => setIsAddOpen(true)}
          className="btn-gold flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Add Account
        </button>
      </div>

      {/* Summary Banner */}
      <div className="glass-card rounded-2xl p-5 border border-border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <span className="text-xs text-muted-foreground uppercase tracking-widest font-bold block">Total Account Balance</span>
          <span className="text-3xl font-extrabold text-foreground block mt-1">
            {formatIndianCurrency(totalBalance)}
          </span>
        </div>
        <div className="p-3.5 rounded-xl bg-gold-500/10 border border-gold-500/20 text-xs text-gold-400 flex gap-2 items-center max-w-md">
          <Info className="w-4.5 h-4.5 shrink-0" />
          <span>Star accounts to lock them to the top of your main dashboard feed.</span>
        </div>
      </div>

      {/* Grid of Accounts */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {accounts.map(acc => {
          const isStarred = starredAccountIds.includes(acc.id);
          const balance = Number(acc.balance);
          const percentShare = totalBalance > 0 ? (balance / totalBalance) * 100 : 0;
          const cfg = getTypeConfig(acc.type);

          // Credit card extras
          const isCredit = acc.type === "credit";
          const creditLimit = isCredit ? getCreditLimit(acc.id) : 0;
          const outstanding = isCredit && balance < 0 ? Math.abs(balance) : 0;
          const available = isCredit && creditLimit > 0 ? creditLimit - outstanding : 0;
          const utilPct = isCredit && creditLimit > 0 ? Math.min((outstanding / creditLimit) * 100, 100) : 0;

          // Get recent transactions for this specific account
          const accTxs = transactions
            .filter(t => t.account_id === acc.id || t.transfer_to_account_id === acc.id)
            .slice(0, 3);

          return (
            <div
              key={acc.id}
              className="glass-card rounded-2xl p-5 border border-border flex flex-col justify-between space-y-4 hover:border-gold-500/30 transition-all group relative overflow-hidden"
            >
              {/* Star flag */}
              <button
                onClick={() => toggleStarAccount(acc.id)}
                className={`absolute top-4 right-4 p-1.5 rounded-lg border transition-all ${
                  isStarred
                    ? "bg-amber-500/15 border-amber-500/30 text-amber-400"
                    : "bg-muted border-border text-muted-foreground hover:text-foreground"
                }`}
                title={isStarred ? "Starred Account" : "Star Account"}
              >
                <Star className={`w-4.5 h-4.5 ${isStarred ? "fill-amber-400" : ""}`} />
              </button>

              {/* Type badge with icon */}
              <div className="space-y-1">
                <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-md border uppercase tracking-wider ${cfg.color}`}>
                  {cfg.icon}
                  {cfg.label}
                </span>
                <h4 className="text-lg font-bold text-foreground pr-8 truncate mt-1 block">{acc.name}</h4>
              </div>

              {/* Balance */}
              <div>
                {isCredit && balance < 0 ? (
                  <div className="space-y-0.5">
                    <span className="text-2xl font-black text-rose-400 block">
                      Outstanding: {formatIndianCurrency(outstanding)}
                    </span>
                    {creditLimit > 0 && (
                      <span className="text-sm text-emerald-400 block">
                        Available: {formatIndianCurrency(available)}
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="text-2xl font-black text-foreground block">
                    {formatIndianCurrency(balance)}
                  </span>
                )}

                {/* Credit utilization bar */}
                {isCredit && creditLimit > 0 && (
                  <div className="space-y-1 mt-2">
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>Credit Used</span>
                      <span className="font-semibold text-foreground">{utilPct.toFixed(1)}% of {formatIndianCurrency(creditLimit)}</span>
                    </div>
                    <div className="w-full h-1.5 bg-muted border border-border rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${utilPct > 80 ? "bg-rose-500" : utilPct > 50 ? "bg-amber-500" : "bg-emerald-500"}`}
                        style={{ width: `${utilPct}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Credit card limit info */}
                {isCredit && creditLimit > 0 && (
                  <div className="mt-1 text-[10px] text-muted-foreground">
                    Credit Limit: {formatIndianCurrency(creditLimit)}
                  </div>
                )}

                {/* Asset share bar (non-credit) */}
                {!isCredit && (
                  <div className="space-y-1 mt-2">
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>Asset Share</span>
                      <span className="font-semibold text-foreground">{percentShare.toFixed(1)}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-muted border border-border rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gold-500 rounded-full"
                        style={{ width: `${Math.max(0, percentShare)}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Recent transaction log */}
              <div className="pt-3 border-t border-border space-y-2">
                <span className="text-[10px] text-muted-foreground uppercase font-bold block">Recent Activity</span>
                {accTxs.length === 0 ? (
                  <span className="text-[11px] text-muted-foreground block py-1">No transactions recorded.</span>
                ) : (
                  <div className="space-y-1.5">
                    {accTxs.map(t => {
                      const isExpense = t.type === "expense";
                      const isTransfer = t.type === "transfer";
                      return (
                        <div key={t.id} className="flex justify-between items-center text-xs">
                          <span className="text-muted-foreground truncate max-w-[120px]" title={t.note || t.category}>
                            {t.note || t.category.split(" ")[0]}
                          </span>
                          <span className={`font-semibold ${
                            isExpense ? "text-rose-400" : isTransfer ? "text-amber-400" : "text-emerald-400"
                          }`}>
                            {isExpense ? "-" : isTransfer ? "" : "+"}{formatIndianCurrency(t.amount, false)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex gap-2 pt-2 justify-between items-center">
                <button
                  onClick={() => toggleStarAccount(acc.id)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold transition-all ${
                    isStarred
                      ? "bg-amber-500/10 border-amber-500/25 text-amber-500 dark:text-amber-400"
                      : "bg-muted border-border text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                  title={isStarred ? "Unpin Account from Dashboard" : "Pin Account to Dashboard"}
                >
                  <Star className={`w-3.5 h-3.5 ${isStarred ? "fill-amber-500 dark:fill-amber-400" : ""}`} />
                  <span>{isStarred ? "Pinned" : "Pin/Star"}</span>
                </button>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setEditingAccount(acc)}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-gold-400 hover:bg-gold-400/10 transition-colors"
                    title="Edit Account Details"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteAccount(acc.id)}
                    disabled={accounts.length <= 1}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10 transition-colors disabled:opacity-30"
                    title="Remove Account Node"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Account Modal */}
      <Modal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title="Add Account Node">
        <form onSubmit={handleCreateAccount} className="space-y-4">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Account Name</label>
            <input
              type="text"
              placeholder="SBI, PayTM, Cash, HDFC etc."
              value={newAccName}
              onChange={(e) => setNewAccName(e.target.value)}
              className="w-full bg-background border border-border rounded-xl min-h-[48px] py-3 px-3.5 text-foreground text-sm focus:outline-none focus:border-gold-500"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <CustomSelect
              label="Account Type"
              options={accountTypeOptions(customAccountTypes)}
              value={newAccType}
              onChange={setNewAccType}
            />

            <NumberInput
              label="Opening Balance (₹)"
              value={newAccBalance}
              onChange={v => setNewAccBalance(v)}
              decimals={true}
              prefix="₹"
              placeholder="Opening balance"
            />
          </div>

          {newAccType === "__custom__" && (
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Custom Account Type Name</label>
              <input
                type="text"
                placeholder="e.g. Wallet, Post Office, Chit Fund"
                value={customTypeName}
                onChange={(e) => setCustomTypeName(e.target.value)}
                className="w-full bg-background border border-border rounded-xl min-h-[48px] py-3 px-3.5 text-foreground text-sm focus:outline-none focus:border-gold-500"
              />
            </div>
          )}

          {newAccType === "credit" && (
            <NumberInput
              label="Credit Limit (₹)"
              value={newCreditLimit}
              onChange={v => setNewCreditLimit(v)}
              decimals={true}
              prefix="₹"
              placeholder="e.g. 50000"
            />
          )}

          <div className="flex gap-3 mt-6 pt-4 border-t border-border">
            <button
              type="button"
              onClick={() => setIsAddOpen(false)}
              className="flex-1 bg-muted hover:bg-muted/80 border border-border text-foreground font-semibold py-2.5 rounded-xl transition-all text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={addingAcc}
              className="flex-1 bg-gold-500 hover:bg-violet-750 text-white font-semibold py-2.5 rounded-xl transition-all shadow-lg hover:shadow-gold-500/30 text-sm"
            >
              {addingAcc ? "Adding..." : "Add Account"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Account Modal */}
      <Modal isOpen={editingAccount !== null} onClose={() => setEditingAccount(null)} title="Edit Account Node">
        {editingAccount && (
          <EditAccountForm account={editingAccount} onClose={() => setEditingAccount(null)} />
        )}
      </Modal>
    </div>
  );
};
