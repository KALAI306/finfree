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
  Calendar
} from "lucide-react";
import { Modal } from "../components/Modal";
import type { Account } from "../lib/db";

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
  const [newAccBalance, setNewAccBalance] = useState("");
  const [customTypeName, setCustomTypeName] = useState("");
  const [addingAcc, setAddingAcc] = useState(false);

  // Calculations
  const totalBalance = accounts.reduce((sum, a) => sum + Number(a.balance), 0);

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccName || !newAccBalance) {
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

      await addAccount({
        user_id: profile!.id,
        name: newAccName,
        type: finalType,
        balance: Number(newAccBalance),
      });

      showToast("Account created successfully", "success");
      setNewAccName("");
      setNewAccBalance("");
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

  // Compile Account Types list
  const defaultTypes = [
    { value: "savings", label: "Savings 🏦" },
    { value: "business", label: "Business 💼" },
    { value: "cash", label: "Cash 💵" }
  ];

  const displayedTypes = [
    ...defaultTypes,
    ...customAccountTypes.map(t => ({ value: t, label: `${t.charAt(0).toUpperCase() + t.slice(1)} 💳` }))
  ];

  // Edit Account Form Sub-component
  const EditAccountForm: React.FC<{ account: Account; onClose: () => void }> = ({ account, onClose }) => {
    const [name, setName] = useState(account.name);
    const [type, setType] = useState(account.type);
    const [balance, setBalance] = useState(account.balance.toString());
    const [editCustomTypeName, setEditCustomTypeName] = useState("");
    const [saving, setSaving] = useState(false);

    const handleEditAccountSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!name || !balance) {
        showToast("Please fill in account name and balance", "warning");
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
            className="w-full bg-background border border-border rounded-xl py-2.5 px-3 text-foreground text-sm focus:outline-none focus:border-gold-500"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Account Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full bg-background border border-border rounded-xl py-2.5 px-3 text-foreground text-sm focus:outline-none focus:border-gold-500"
            >
              {displayedTypes.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
              <option value="__custom__">+ Add Custom Type...</option>
            </select>
          </div>

          <div>
            <label className="text-xs text-muted-foreground block mb-1">Current Balance (₹)</label>
            <input
              type="number"
              step="any"
              value={balance}
              readOnly
              disabled
              className="w-full bg-muted/30 border border-border rounded-xl py-2.5 px-3 text-muted-foreground text-sm cursor-not-allowed opacity-60"
            />
            <p className="text-[10px] text-muted-foreground mt-1">Auto-calculated from transactions</p>
          </div>
        </div>

        {type === "__custom__" && (
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Custom Account Type Name</label>
            <input
              type="text"
              placeholder="e.g. Wallet, Post Office, Credit"
              value={editCustomTypeName}
              onChange={(e) => setEditCustomTypeName(e.target.value)}
              className="w-full bg-background border border-border rounded-xl py-2.5 px-3 text-foreground text-sm focus:outline-none focus:border-gold-500"
            />
          </div>
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
          const percentShare = totalBalance > 0 ? (Number(acc.balance) / totalBalance) * 100 : 0;
          
          // Get recent transactions for this specific account
          const accTxs = transactions.filter(t => t.account_id === acc.id || t.transfer_to_account_id === acc.id).slice(0, 3);

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

              <div className="space-y-1">
                <span className="text-[10px] font-bold text-gold-400 bg-gold-500/10 border border-gold-500/20 px-2 py-0.5 rounded-md uppercase tracking-wider inline-block">
                  {acc.type}
                </span>
                <h4 className="text-lg font-bold text-foreground pr-8 truncate mt-1 block">{acc.name}</h4>
              </div>

              <div>
                <span className="text-2xl font-black text-foreground block">
                  {formatIndianCurrency(acc.balance)}
                </span>
                {/* Share percentage bar */}
                <div className="space-y-1 mt-2">
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>Asset Share</span>
                    <span className="font-semibold text-foreground">{percentShare.toFixed(1)}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-muted border border-border rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gold-500 rounded-full"
                      style={{ width: `${percentShare}%` }}
                    />
                  </div>
                </div>
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
              className="w-full bg-background border border-border rounded-xl py-2.5 px-3 text-foreground text-sm focus:outline-none focus:border-gold-500"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Account Type</label>
              <select
                value={newAccType}
                onChange={(e) => setNewAccType(e.target.value)}
                className="w-full bg-background border border-border rounded-xl py-2.5 px-3 text-foreground text-sm focus:outline-none focus:border-gold-500"
              >
                {displayedTypes.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
                <option value="__custom__">+ Add Custom Type...</option>
              </select>
            </div>

            <div>
              <label className="text-xs text-muted-foreground block mb-1">Opening Balance (₹)</label>
              <input
                type="number"
                placeholder="Opening balance"
                value={newAccBalance}
                onChange={(e) => setNewAccBalance(e.target.value)}
                className="w-full bg-background border border-border rounded-xl py-2.5 px-3 text-foreground text-sm focus:outline-none focus:border-gold-500"
              />
            </div>
          </div>

          {newAccType === "__custom__" && (
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Custom Account Type Name</label>
              <input
                type="text"
                placeholder="e.g. Wallet, Post Office, Chit Fund"
                value={customTypeName}
                onChange={(e) => setCustomTypeName(e.target.value)}
                className="w-full bg-background border border-border rounded-xl py-2.5 px-3 text-foreground text-sm focus:outline-none focus:border-gold-500"
              />
            </div>
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
