import React, { useState, useRef } from "react";
import { useApp } from "../context/AppContext";
import { formatIndianCurrency, compressImage } from "../lib/utils";
import { addAccount, deleteAccount, updateAccount, supabase, resetUserDatabase } from "../lib/db";
import {
  User,
  Wallet,
  Lock,
  Download,
  Plus,
  Trash2,
  Edit2,
  Settings as SettingsIcon,
  Upload,
  Smartphone,
  Cloud,
  FileJson,
  FileSpreadsheet,
  FolderOpen,
} from "lucide-react";
import { Modal } from "../components/Modal";
import type { Account } from "../lib/db";
import { exportData, downloadBackupJSON, downloadTransactionsCSV, readBackupFile, importData, type FinFreeBackup } from "../lib/exportImport";
import { getStorageMode, setStorageMode, type StorageMode } from "../lib/storageMode";

export const Settings: React.FC = () => {
  const { user, profile, accounts, transactions, updateUserProfile, showToast, refreshData, customAccountTypes, addCustomAccountType, profileImage, updateProfileImage } = useApp();
  
  // Profile settings state
  const [profileName, setProfileName] = useState(profile?.name || "Kalai");
  const [profileAge, setProfileAge] = useState(profile?.age || 23);
  const [profileSalary, setProfileSalary] = useState(profile?.monthly_salary || 20000);
  const [profileTarget, setProfileTarget] = useState(profile?.freedom_target || 9000000);
  const [familyDebt, setFamilyDebt] = useState(profile?.family_debt || 228116);
  const [profileImgUrl, setProfileImgUrl] = useState(profileImage || "");
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [resettingDb, setResettingDb] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Storage mode & export/import
  const [storageMode, setStorageModeState] = useState<StorageMode>(getStorageMode);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importPreview, setImportPreview] = useState<FinFreeBackup | null>(null);
  const importFileRef = useRef<HTMLInputElement>(null);

  const handleStorageModeChange = (mode: StorageMode) => {
    setStorageMode(mode);
    setStorageModeState(mode);
    showToast(`Switched to ${mode === 'local' ? 'Local' : 'Cloud'} storage`, 'success');
  };

  const handleExportJSON = async () => {
    if (!user) return;
    setExporting(true);
    try {
      const backup = await exportData(user.id);
      downloadBackupJSON(backup);
      showToast('Backup downloaded!', 'success');
    } catch {
      showToast('Export failed', 'error');
    } finally {
      setExporting(false);
    }
  };

  const handleExportCSVNew = async () => {
    if (!user) return;
    setExporting(true);
    try {
      const backup = await exportData(user.id);
      downloadTransactionsCSV(backup.transactions);
      showToast('CSV downloaded!', 'success');
    } catch {
      showToast('Export failed', 'error');
    } finally {
      setExporting(false);
    }
  };

  const handleImportPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const backup = await readBackupFile(file);
      setImportPreview(backup);
    } catch (err: any) {
      showToast(err.message || 'Invalid backup file', 'error');
    }
    e.target.value = '';
  };

  const handleImportConfirm = async (mode: 'replace' | 'merge') => {
    if (!importPreview || !user) return;
    setImporting(true);
    try {
      await importData(importPreview, user.id, mode);
      showToast(`Data ${mode === 'replace' ? 'replaced' : 'merged'} successfully!`, 'success');
      setImportPreview(null);
      refreshData();
    } catch {
      showToast('Import failed', 'error');
    } finally {
      setImporting(false);
    }
  };

  const handleResetDatabase = async () => {
    if (!window.confirm("WARNING: Are you absolutely sure you want to delete ALL your live financial data (accounts, transactions, EMIs, investments, and goals)? This action is permanent and cannot be undone.")) {
      return;
    }
    if (!user) return;
    setResettingDb(true);
    try {
      const uId = user.id;
      await resetUserDatabase(uId);
      showToast("Live database successfully reset!", "success");
      refreshData();
    } catch (err) {
      showToast("Failed to reset database", "error");
    } finally {
      setResettingDb(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const base64Data = await compressImage(file, 200, 200, 0.7); // Tiny size for avatars
      setProfileImgUrl(base64Data);
      showToast("Avatar image compressed & loaded!", "success");
    } catch (err) {
      showToast("Failed to parse avatar image file", "error");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const PRESET_AVATARS = [
    { name: "Avatar 1", url: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=80&q=80" },
    { name: "Avatar 2", url: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=80&q=80" },
    { name: "Avatar 3", url: "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=80&q=80" },
    { name: "Avatar 4", url: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=80&q=80" },
    { name: "Avatar 5", url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=80&q=80" },
  ];

  // Sync state if profile loads after
  React.useEffect(() => {
    if (profile) {
      setProfileName(profile.name);
      setProfileAge(profile.age);
      setProfileSalary(profile.monthly_salary);
      setProfileTarget(profile.freedom_target);
      setFamilyDebt(profile.family_debt);
    }
    if (profileImage) {
      setProfileImgUrl(profileImage);
    }
  }, [profile, profileImage]);

  // Account creation state
  const [newAccName, setNewAccName] = useState("");
  const [newAccType, setNewAccType] = useState<string>("savings");
  const [newAccBalance, setNewAccBalance] = useState("");
  const [customTypeName, setCustomTypeName] = useState("");
  const [addingAcc, setAddingAcc] = useState(false);

  // Account editing state
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);

  // Password reset state
  const [newPassword, setNewPassword] = useState("");
  const [updatingPass, setUpdatingPass] = useState(false);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileName) {
      showToast("Name cannot be empty", "warning");
      return;
    }
    setSavingProfile(true);
    try {
      await updateUserProfile({
        name: profileName,
        age: Number(profileAge),
        monthly_salary: Number(profileSalary),
        freedom_target: Number(profileTarget),
        family_debt: Number(familyDebt),
      });
      updateProfileImage(profileImgUrl);
    } catch (err) {
      showToast("Failed to save profile settings", "error");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccName || !newAccBalance) {
      showToast("Please fill in account name and starting balance", "warning");
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
      showToast("Account added successfully", "success");
      setNewAccName("");
      setNewAccBalance("");
      setCustomTypeName("");
      setNewAccType("savings");
      refreshData();
    } catch (err) {
      showToast("Failed to create account", "error");
    } finally {
      setAddingAcc(false);
    }
  };

  const handleDeleteAccount = async (id: string) => {
    const acc = accounts.find(a => a.id === id);
    if (!acc) return;
    if (!window.confirm(`Are you sure you want to delete ${acc.name}? Deleting this account will not erase transaction histories but will disrupt net worth tracking.`)) return;

    try {
      await deleteAccount(id);
      showToast("Account deleted", "info");
      refreshData();
    } catch (err) {
      showToast("Failed to delete account", "error");
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      showToast("Password must be at least 6 characters", "warning");
      return;
    }

    setUpdatingPass(true);
    try {
      if (!supabase) {
        showToast("Password updates require Supabase to be configured", "warning");
        return;
      }

      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      showToast("Password updated successfully", "success");
      setNewPassword("");
    } catch (err: any) {
      showToast(err.message || "Failed to update password", "error");
    } finally {
      setUpdatingPass(false);
    }
  };

  const handleExportCSV = () => {
    if (transactions.length === 0) {
      showToast("No transaction records found to export", "warning");
      return;
    }

    const headers = ["Date", "Type", "Category", "Amount", "Note", "Is Recurring"];
    const rows = transactions.map((t) => [
      t.date,
      t.type,
      t.category,
      t.amount,
      t.note || "",
      t.is_recurring ? "TRUE" : "FALSE",
    ]);

    const csvContent = [headers, ...rows]
      .map((e) => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `FinFree_transactions_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Data downloaded as CSV", "success");
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
          balance: Number(balance)
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
              onChange={(e) => setBalance(e.target.value)}
              className="w-full bg-background border border-border rounded-xl py-2.5 px-3 text-foreground text-sm focus:outline-none focus:border-gold-500"
            />
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
            className="flex-1 bg-gold-500 hover:bg-gold-600 text-white font-semibold py-2.5 rounded-xl transition-all shadow-lg hover:shadow-gold-500/30 text-sm"
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
      <div>
        <h2 className="text-2xl md:text-3xl font-extrabold m-0 text-foreground">Settings</h2>
        <p className="text-muted-foreground text-sm mt-1">Configure profile thresholds & manage connected nodes</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Profile Card Form */}
        <div className="glass-card rounded-2xl p-6 border border-border space-y-4">
          <h4 className="text-base font-bold text-foreground mb-2 flex items-center gap-2">
            <User className="w-5 h-5 text-gold-400" /> Edit Profile
          </h4>
          
          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Your Name</label>
                <input
                  type="text"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  className="w-full bg-background border border-border rounded-xl py-2 px-3 text-foreground text-sm focus:outline-none focus:border-gold-500"
                />
              </div>

              <div>
                <label className="text-xs text-muted-foreground block mb-1">Age</label>
                <input
                  type="number"
                  value={profileAge}
                  onChange={(e) => setProfileAge(Number(e.target.value))}
                  className="w-full bg-background border border-border rounded-xl py-2 px-3 text-foreground text-sm focus:outline-none focus:border-gold-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Monthly Salary (₹)</label>
                <input
                  type="number"
                  value={profileSalary}
                  onChange={(e) => setProfileSalary(Number(e.target.value))}
                  className="w-full bg-background border border-border rounded-xl py-2 px-3 text-foreground text-sm focus:outline-none focus:border-gold-500"
                />
              </div>

              <div>
                <label className="text-xs text-muted-foreground block mb-1">Family Debt Liability (₹)</label>
                <input
                  type="number"
                  value={familyDebt}
                  onChange={(e) => setFamilyDebt(Number(e.target.value))}
                  className="w-full bg-background border border-border rounded-xl py-2 px-3 text-foreground text-sm focus:outline-none focus:border-gold-500"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-muted-foreground block mb-1">Freedom Target corpus (₹)</label>
              <input
                type="number"
                value={profileTarget}
                onChange={(e) => setProfileTarget(Number(e.target.value))}
                className="w-full bg-background border border-border rounded-xl py-2 px-3 text-foreground text-sm focus:outline-none focus:border-gold-500"
              />
            </div>

            <div>
              <label className="text-xs text-muted-foreground block mb-1">Profile Image URL</label>
              <input
                type="text"
                placeholder="Paste avatar URL (e.g. from Unsplash) or choose preset below"
                value={profileImgUrl}
                onChange={(e) => setProfileImgUrl(e.target.value)}
                className="w-full bg-background border border-border rounded-xl py-2 px-3 text-foreground text-sm focus:outline-none focus:border-gold-500 mb-2"
              />
              <div className="flex gap-2.5 items-center flex-wrap">
                {PRESET_AVATARS.map((av, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setProfileImgUrl(av.url)}
                    className={`w-9 h-9 rounded-full overflow-hidden border-2 transition-all ${profileImgUrl === av.url ? "border-violet-600 scale-105" : "border-transparent opacity-70 hover:opacity-100"}`}
                    title={av.name}
                  >
                    <img src={av.url} className="w-full h-full object-cover" alt={av.name} />
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setProfileImgUrl("")}
                  className={`px-2.5 py-1 rounded-lg bg-muted text-[10px] font-bold text-muted-foreground border hover:text-foreground border-border ${!profileImgUrl ? "border-violet-600" : "border-transparent"}`}
                  title="Clear profile avatar"
                >
                  Clear
                </button>
                <input
                  type="file"
                  ref={avatarInputRef}
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  className="px-2.5 py-1 rounded-lg bg-muted text-[10px] font-bold text-muted-foreground border border-border border-transparent hover:text-foreground flex items-center gap-1.5 transition-all"
                  title="Upload profile picture"
                >
                  <Upload className="w-3 h-3 text-gold-400" />
                  {uploadingAvatar ? "Loading..." : "Upload File"}
                </button>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={savingProfile}
                className="bg-gold-500 hover:bg-gold-600 text-white font-semibold py-2 px-4 rounded-xl text-xs md:text-sm transition-all shadow shadow-violet-600/20"
              >
                {savingProfile ? "Saving..." : "Save Profile Details"}
              </button>
            </div>
          </form>
        </div>

        {/* Account Management card */}
        <div className="glass-card rounded-2xl p-6 border border-border space-y-4">
          <h4 className="text-base font-bold text-foreground mb-2 flex items-center gap-2">
            <Wallet className="w-5 h-5 text-gold-400" /> Account Nodes
          </h4>

          {/* List Accounts */}
          <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
            {accounts.map(acc => (
              <div key={acc.id} className="flex justify-between items-center bg-muted/20 border border-border p-3 rounded-xl hover:bg-muted/40 transition-all">
                <div>
                  <span className="text-sm font-bold text-foreground block">{acc.name}</span>
                  <span className="text-[10px] text-muted-foreground capitalize">{acc.type} account</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-semibold text-foreground pr-2">
                    {formatIndianCurrency(acc.balance)}
                  </span>
                  
                  <button
                    onClick={() => setEditingAccount(acc)}
                    className="p-1 text-muted-foreground hover:text-gold-400 hover:bg-gold-400/10 rounded-lg transition-all"
                    title="Edit Account"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => handleDeleteAccount(acc.id)}
                    disabled={accounts.length <= 1}
                    className="p-1 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-all disabled:opacity-30"
                    title="Delete Account"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Add Account Form */}
          <form onSubmit={handleCreateAccount} className="pt-2 border-t border-border space-y-3">
            <span className="text-xs font-semibold text-muted-foreground block uppercase tracking-wider">Add New Account</span>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input
                type="text"
                placeholder="SBI, PayTM, Cash"
                value={newAccName}
                onChange={(e) => setNewAccName(e.target.value)}
                className="bg-background border border-border rounded-xl py-2 px-3 text-foreground text-xs focus:outline-none focus:border-gold-500"
              />
              <select
                value={newAccType}
                onChange={(e) => setNewAccType(e.target.value)}
                className="bg-background border border-border rounded-xl py-2 px-3 text-foreground text-xs focus:outline-none focus:border-gold-500"
              >
                {displayedTypes.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
                <option value="__custom__">+ Add Custom Type...</option>
              </select>
              <input
                type="number"
                placeholder="Opening Bal"
                value={newAccBalance}
                onChange={(e) => setNewAccBalance(e.target.value)}
                className="bg-background border border-border rounded-xl py-2 px-3 text-foreground text-xs focus:outline-none focus:border-gold-500"
              />
            </div>

            {newAccType === "__custom__" && (
              <div>
                <input
                  type="text"
                  placeholder="Custom Account Type Name"
                  value={customTypeName}
                  onChange={(e) => setCustomTypeName(e.target.value)}
                  className="w-full bg-background border border-border rounded-xl py-2 px-3 text-foreground text-xs focus:outline-none focus:border-gold-500"
                />
              </div>
            )}

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={addingAcc}
                className="bg-muted hover:bg-muted/80 border border-border text-foreground font-semibold py-2 px-4 rounded-xl text-xs flex items-center gap-1.5 transition-all"
              >
                <Plus className="w-3.5 h-3.5" /> {addingAcc ? "Adding..." : "Add Account Node"}
              </button>
            </div>
          </form>
        </div>

        {/* Security & Password reset */}
        <div className="glass-card rounded-2xl p-6 border border-border space-y-4">
          <h4 className="text-base font-bold text-foreground mb-2 flex items-center gap-2">
            <Lock className="w-5 h-5 text-gold-400" /> Account Security
          </h4>

          <form onSubmit={handleChangePassword} className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">New Password</label>
              <input
                type="password"
                placeholder="At least 6 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full bg-background border border-border rounded-xl py-2 px-3 text-foreground text-sm focus:outline-none focus:border-gold-500"
              />
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={updatingPass}
                className="bg-gold-500 hover:bg-gold-600 text-white font-semibold py-2 px-4 rounded-xl text-xs transition-all"
              >
                {updatingPass ? "Updating..." : "Update Password"}
              </button>
            </div>
          </form>
        </div>

        {/* Storage Mode */}
        <div className="glass-card rounded-2xl p-6 border border-border space-y-4">
          <h4 className="text-base font-bold text-foreground flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-primary" /> Storage Mode
          </h4>
          <p className="text-xs text-muted-foreground">Choose where your financial data is stored.</p>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => handleStorageModeChange('local')}
              className={`p-4 rounded-xl border-2 text-left transition-all ${storageMode === 'local' ? 'border-primary bg-primary/10' : 'border-border/50 bg-white/[0.02] hover:border-border'}`}
            >
              <Smartphone className={`w-5 h-5 mb-2 ${storageMode === 'local' ? 'text-primary' : 'text-muted-foreground'}`} />
              <p className={`text-xs font-semibold ${storageMode === 'local' ? 'text-primary' : 'text-foreground'}`}>Local Only</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">On-device · Offline</p>
            </button>
            <button
              onClick={() => handleStorageModeChange('cloud')}
              className={`p-4 rounded-xl border-2 text-left transition-all ${storageMode === 'cloud' ? 'border-primary bg-primary/10' : 'border-border/50 bg-white/[0.02] hover:border-border'}`}
            >
              <Cloud className={`w-5 h-5 mb-2 ${storageMode === 'cloud' ? 'text-primary' : 'text-muted-foreground'}`} />
              <p className={`text-xs font-semibold ${storageMode === 'cloud' ? 'text-primary' : 'text-foreground'}`}>Cloud Sync</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Supabase · Multi-device</p>
            </button>
          </div>
        </div>

        {/* Export & Import */}
        <div className="glass-card rounded-2xl p-6 border border-border space-y-5">
          <h4 className="text-base font-bold text-foreground flex items-center gap-2">
            <Download className="w-5 h-5 text-primary" /> Export & Import
          </h4>

          {/* Export */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Export</p>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleExportJSON}
                disabled={exporting}
                className="flex items-center gap-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 font-semibold py-2.5 px-4 rounded-xl text-xs transition-all disabled:opacity-50 cursor-pointer"
              >
                <FileJson className="w-4 h-4" />
                Full Backup (.JSON)
              </button>
              <button
                onClick={handleExportCSVNew}
                disabled={exporting}
                className="flex items-center gap-2 bg-white/[0.04] hover:bg-white/[0.08] text-foreground border border-border font-semibold py-2.5 px-4 rounded-xl text-xs transition-all disabled:opacity-50 cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4" />
                Transactions (.CSV)
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">JSON backup includes all data and can be restored. CSV is for spreadsheet use only.</p>
          </div>

          {/* Import */}
          <div className="border-t border-border/50 pt-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Import</p>
            <input ref={importFileRef} type="file" accept=".json" className="hidden" onChange={handleImportPick} />
            <button
              onClick={() => importFileRef.current?.click()}
              className="flex items-center gap-2 bg-white/[0.04] hover:bg-white/[0.08] text-foreground border border-border font-semibold py-2.5 px-4 rounded-xl text-xs transition-all cursor-pointer"
            >
              <FolderOpen className="w-4 h-4" />
              Choose Backup File (.JSON)
            </button>
            <p className="text-[11px] text-muted-foreground mt-2">Only FinFree .json backup files are supported.</p>
          </div>

          {/* Import Preview Modal */}
          {importPreview && (
            <div className="border border-primary/30 bg-primary/5 rounded-xl p-4 space-y-3">
              <p className="text-xs font-semibold text-foreground">Backup found:</p>
              <div className="grid grid-cols-3 gap-2 text-center">
                {[
                  { label: 'Transactions', count: importPreview.transactions.length },
                  { label: 'Accounts', count: importPreview.accounts.length },
                  { label: 'Investments', count: importPreview.investments.length },
                  { label: 'EMIs', count: importPreview.emis.length },
                  { label: 'Goals', count: importPreview.goals.length },
                ].map(({ label, count }) => (
                  <div key={label} className="bg-white/[0.04] rounded-lg py-2">
                    <p className="text-sm font-bold text-foreground">{count}</p>
                    <p className="text-[10px] text-muted-foreground">{label}</p>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">Exported: {new Date(importPreview.exported_at).toLocaleDateString()}</p>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => handleImportConfirm('merge')}
                  disabled={importing}
                  className="flex-1 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 font-semibold py-2 rounded-xl text-xs transition-all disabled:opacity-50 cursor-pointer"
                >
                  {importing ? 'Importing...' : 'Merge with existing'}
                </button>
                <button
                  onClick={() => handleImportConfirm('replace')}
                  disabled={importing}
                  className="flex-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 font-semibold py-2 rounded-xl text-xs transition-all disabled:opacity-50 cursor-pointer"
                >
                  Replace all
                </button>
                <button
                  onClick={() => setImportPreview(null)}
                  className="px-3 bg-white/[0.04] hover:bg-white/[0.08] text-muted-foreground border border-border rounded-xl text-xs cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Danger Zone */}
        <div className="glass-card rounded-2xl p-6 border border-red-500/20 bg-red-500/[0.02] space-y-4 flex flex-col justify-between">
          <div>
            <h4 className="text-base font-bold text-rose-500 mb-2 flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-rose-500" /> Danger Zone
            </h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Wipe all accounts, transaction logs, investments, EMIs, and goals from this live profile to start fresh. This action is permanent and cannot be undone.
            </p>
          </div>

          <div className="pt-4 border-t border-border/40 flex justify-end">
            <button
              type="button"
              onClick={handleResetDatabase}
              disabled={resettingDb}
              className="bg-rose-600 hover:bg-rose-700 text-white font-semibold py-2.5 px-4 rounded-xl text-xs flex items-center gap-1.5 transition-all shadow disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" />
              {resettingDb ? "Resetting..." : "Reset Live Database"}
            </button>
          </div>
        </div>

      </div>

      {/* Edit Account Modal */}
      <Modal isOpen={editingAccount !== null} onClose={() => setEditingAccount(null)} title="Edit Account Node">
        {editingAccount && (
          <EditAccountForm account={editingAccount} onClose={() => setEditingAccount(null)} />
        )}
      </Modal>
    </div>
  );
};
