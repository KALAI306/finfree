import React, { useState, useRef, useEffect } from "react";
import { useApp } from "../context/AppContext";
import { compressImage } from "../lib/utils";
import { addAccount, deleteAccount, updateAccount, supabase, resetUserDatabase, getMcpToken, generateMcpToken, revokeMcpToken } from "../lib/db";
import { Capacitor } from "@capacitor/core";
import { isPinSet, setPin, clearPin, PinPad } from "../components/BiometricLock";
import { CURRENCIES } from "../lib/utils";
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
  PiggyBank,
  Shield,
  KeyRound,
  Bot,
  Copy,
  RotateCw,
  Link as LinkIcon,
  CheckCheck,
} from "lucide-react";
import { isNativePlatform } from "../lib/smsListener";
import { SmsHistoryImport } from "../components/SmsHistoryImport";
import { getNotifSettings, saveNotifSettings as saveNotifSettingsFn, requestNotificationPermission, sendTestNotification } from "../lib/notifications";
import { Bell } from "lucide-react";

// Budget Limits sub-component
const ALL_BUDGET_CATS = [
  "Food 🍕","Fuel ⛽","Rent/PG 🏠","EMI 💳","Healthcare 🏥","Medical 💊",
  "Shopping 🛍️","Recharges 📱","Gold Investment 🥇","Investment 📈",
  "Entertainment 🎬","Clothing 👕","Daily Workers 👷","Miscellaneous 🎯",
];

const BudgetLimitsCard: React.FC<{
  budgetLimits: Record<string, number>;
  setBudgetLimit: (cat: string, amt: number) => void;
  removeBudgetLimit: (cat: string) => void;
}> = ({ budgetLimits, setBudgetLimit, removeBudgetLimit }) => {
  const [selectedCat, setSelectedCat] = useState(ALL_BUDGET_CATS[0]);
  const [limitAmount, setLimitAmount] = useState("");

  const handleAdd = () => {
    if (!limitAmount || Number(limitAmount) <= 0) return;
    setBudgetLimit(selectedCat, Number(limitAmount));
    setLimitAmount("");
  };

  return (
    <div className="glass-card rounded-2xl p-6 border border-border space-y-4">
      <h4 className="text-base font-bold text-foreground mb-2 flex items-center gap-2">
        <PiggyBank className="w-5 h-5 text-gold-400" /> Monthly Budget Limits
      </h4>
      <p className="text-xs text-muted-foreground">Set monthly spending caps per category. You'll get a warning when exceeded.</p>
      <div className="flex gap-2">
        <select value={selectedCat} onChange={e => setSelectedCat(e.target.value)}
          className="flex-1 bg-background border border-border rounded-xl py-2 px-3 text-foreground text-xs focus:outline-none focus:border-primary">
          {ALL_BUDGET_CATS.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <input type="number" placeholder="₹ Limit" value={limitAmount}
          onChange={e => setLimitAmount(e.target.value)}
          className="w-28 bg-background border border-border rounded-xl py-2 px-3 text-foreground text-xs focus:outline-none focus:border-primary" />
        <button onClick={handleAdd}
          className="px-3 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-all">
          Set
        </button>
      </div>
      {Object.keys(budgetLimits).length > 0 && (
        <div className="space-y-2">
          {Object.entries(budgetLimits).map(([cat, amt]) => (
            <div key={cat} className="flex items-center justify-between px-3 py-2 rounded-xl bg-muted/20 border border-border">
              <span className="text-xs font-medium text-foreground">{cat}</span>
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono font-bold text-primary">₹{amt.toLocaleString('en-IN')}</span>
                <button onClick={() => removeBudgetLimit(cat)} className="text-rose-400 hover:text-rose-300 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
// App PIN lock sub-component (web only — native uses biometric)
const AppPinCard: React.FC = () => {
  const [pinEnabled, setPinEnabled] = useState(() => isPinSet());
  const [step, setStep] = useState<'idle' | 'enter' | 'confirm'>('idle');
  const [firstPin, setFirstPin] = useState('');
  const [feedback, setFeedback] = useState('');

  const handleFirstPin = (pin: string) => {
    setFirstPin(pin);
    setStep('confirm');
    setFeedback('');
  };

  const handleConfirmPin = async (pin: string) => {
    await setPin(pin);
    setPinEnabled(true);
    setStep('idle');
    setFeedback('PIN set! You will be asked for it next time you open the app.');
  };

  const handleClear = () => {
    clearPin();
    setPinEnabled(false);
    setStep('idle');
    setFeedback('App PIN removed.');
  };

  // Shown on both web and native (native uses biometric + PIN fallback)

  return (
    <div className="glass-card rounded-2xl p-6 border border-border space-y-4">
      <h4 className="text-base font-bold text-foreground mb-2 flex items-center gap-2">
        <KeyRound className="w-5 h-5 text-gold-400" /> App PIN Lock
      </h4>
      <p className="text-xs text-muted-foreground">
        Set a 4-digit PIN to lock the app when you reopen it in the browser. PIN is hashed and stored locally — never sent to servers.
      </p>

      {feedback && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-primary/5 border border-primary/10 text-xs text-primary">
          <Shield className="w-3.5 h-3.5 shrink-0" />{feedback}
        </div>
      )}

      {step === 'idle' && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${pinEnabled ? 'bg-green-400' : 'bg-muted-foreground/40'}`} />
            <span className="text-xs text-muted-foreground">{pinEnabled ? 'PIN lock is active' : 'No PIN set'}</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => { setStep('enter'); setFeedback(''); }}
              className="px-3 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 text-xs font-semibold transition-all cursor-pointer"
            >
              {pinEnabled ? 'Change PIN' : 'Set PIN'}
            </button>
            {pinEnabled && (
              <button
                onClick={handleClear}
                className="px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-xs font-semibold transition-all cursor-pointer"
              >
                Remove
              </button>
            )}
          </div>
        </div>
      )}

      {step === 'enter' && (
        <div className="flex flex-col items-center gap-3 pt-2">
          <p className="text-xs font-medium text-muted-foreground">Enter a new 4-digit PIN</p>
          <PinPad verify={false} onSuccess={handleFirstPin} onCancel={() => setStep('idle')} />
        </div>
      )}

      {step === 'confirm' && (
        <div className="flex flex-col items-center gap-3 pt-2">
          <p className="text-xs font-medium text-muted-foreground">Confirm your PIN</p>
          <PinPad verify={false} confirmPin={firstPin} onSuccess={handleConfirmPin} onCancel={() => setStep('enter')} />
        </div>
      )}
    </div>
  );
};

const MCP_BASE_URL = 'https://jqqreupesjhzseyphxds.supabase.co/functions/v1/finfree-mcp';

const ClaudeConnectCard: React.FC<{ userId: string; isLocal: boolean }> = ({ userId, isLocal }) => {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    getMcpToken(userId).then(t => { setToken(t); setLoading(false); });
  }, [userId]);

  const mcpUrl = token ? `${MCP_BASE_URL}?token=${token}` : '';

  const handleGenerate = async () => {
    setBusy(true);
    try {
      const t = await generateMcpToken(userId);
      setToken(t);
    } catch {}
    setBusy(false);
  };

  const handleRevoke = async () => {
    setBusy(true);
    try {
      await revokeMcpToken(userId);
      setToken(null);
    } catch {}
    setBusy(false);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(mcpUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="glass-card rounded-2xl p-6 border border-border space-y-4">
      <h4 className="text-base font-bold text-foreground flex items-center gap-2">
        <Bot className="w-5 h-5 text-gold-400" /> Connect to Claude AI
      </h4>
      <p className="text-xs text-muted-foreground">
        Ask Claude about your finances directly on claude.ai — spending, goals, net worth and more.
      </p>

      {isLocal && (
        <div className="px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-400">
          Switch to Cloud mode (Settings → Storage) to enable Claude AI connection.
        </div>
      )}

      {!isLocal && (
        <>
          {loading ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <RotateCw className="w-3.5 h-3.5 animate-spin" /> Loading…
            </div>
          ) : token ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-muted/20 border border-border">
                <LinkIcon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <span className="text-[10px] font-mono text-muted-foreground truncate flex-1">{mcpUrl}</span>
                <button onClick={handleCopy} className="shrink-0 text-primary hover:text-primary/80 transition-colors cursor-pointer">
                  {copied ? <CheckCheck className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>

              <div className="px-3 py-2.5 rounded-xl bg-primary/5 border border-primary/10 space-y-1.5">
                <p className="text-[11px] font-semibold text-primary">How to connect:</p>
                <ol className="text-[11px] text-muted-foreground space-y-1 list-none">
                  <li>1. Copy the URL above</li>
                  <li>2. Go to <span className="text-foreground font-medium">claude.ai</span> → Settings</li>
                  <li>3. Click <span className="text-foreground font-medium">Integrations → Add</span></li>
                  <li>4. Paste the URL → Save</li>
                  <li>5. Ask Claude anything about your finances!</li>
                </ol>
              </div>

              <div className="flex gap-2">
                <button onClick={handleCopy} disabled={busy}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-all cursor-pointer">
                  {copied ? <CheckCheck className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copied!' : 'Copy URL'}
                </button>
                <button onClick={handleRevoke} disabled={busy}
                  className="px-3 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-xs font-semibold transition-all cursor-pointer">
                  Revoke
                </button>
              </div>
            </div>
          ) : (
            <button onClick={handleGenerate} disabled={busy}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-all cursor-pointer">
              {busy ? <RotateCw className="w-4 h-4 animate-spin" /> : <Bot className="w-4 h-4" />}
              {busy ? 'Generating…' : 'Generate My MCP URL'}
            </button>
          )}
        </>
      )}
    </div>
  );
};

import { Modal } from "../components/Modal";
import type { Account } from "../lib/db";
import { exportData, downloadBackupJSON, downloadTransactionsCSV, readBackupFile, importData, type FinFreeBackup } from "../lib/exportImport";
import { getStorageMode, setStorageMode, type StorageMode } from "../lib/storageMode";
import { fetchAISettings } from "../lib/openai";
import { migrateCloudToLocal } from "../lib/migration";

export const Settings: React.FC = () => {
  const { user, profile, accounts, transactions, updateUserProfile, showToast, refreshData, customAccountTypes, addCustomAccountType, profileImage, updateProfileImage, budgetLimits, setBudgetLimit, removeBudgetLimit, currency, setCurrency, fmt: formatIndianCurrency } = useApp();
  
  // Profile settings state
  const [profileName, setProfileName] = useState(profile?.name || "Kalai");
  const [profileAge, setProfileAge] = useState<number | ''>(profile?.age || 23);
  const [profileSalary, setProfileSalary] = useState<number | ''>(profile?.monthly_salary || 20000);
  const [profileTarget, setProfileTarget] = useState<number | ''>(profile?.freedom_target || 9000000);
  const [familyDebt, setFamilyDebt] = useState<number | ''>(profile?.family_debt || 228116);
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
  const [showAppBanner, setShowAppBanner] = useState(false);
  const [appDownloadUrl, setAppDownloadUrl] = useState('');

  // Fetch admin-configured app download URL
  useEffect(() => {
    fetchAISettings().then(s => {
      if (s.app_download_url) setAppDownloadUrl(s.app_download_url);
    }).catch(() => {});
  }, []);

  const handleStorageModeChange = async (mode: StorageMode) => {
    setStorageMode(mode);
    setStorageModeState(mode);
    if (mode === 'local') {
      if (!Capacitor.isNativePlatform()) {
        setShowAppBanner(true);
      }
      if (user) {
        showToast('Syncing your cloud data locally…', 'info');
        const migrated = await migrateCloudToLocal(user.id);
        showToast(migrated ? 'Data synced! Now using local storage.' : 'Switched to local storage.', 'success');
      }
    } else {
      setShowAppBanner(false);
      showToast('Switched to Cloud storage', 'success');
    }
    refreshData();
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
  const [upiAutoReadEnabled, setUpiAutoReadEnabled] = useState(() => localStorage.getItem('finfree_upi_autoread') === '1');
  const [upiDefaultAccount, setUpiDefaultAccount] = useState(() => localStorage.getItem('finfree_upi_default_account') || '');
  const [showSmsImport, setShowSmsImport] = useState(false);
  const [notifSettings, setNotifSettings] = useState(getNotifSettings);

  const handleRequestNotifPerm = async () => {
    await requestNotificationPermission();
  };
  const handleTestNotification = async () => {
    await requestNotificationPermission();
    await sendTestNotification();
  };

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

          {user?.email && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-primary/5 border border-primary/10 mb-2">
              <span className="text-xs text-muted-foreground">Logged in as</span>
              <span className="text-xs font-semibold text-primary truncate">{user.email}</span>
            </div>
          )}

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
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  value={profileAge}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => { const v = e.target.value; if (/^[0-9]*$/.test(v)) setProfileAge(v === "" ? "" : Number(v)); }}
                  className="w-full bg-background border border-border rounded-xl py-2 px-3 text-foreground text-sm focus:outline-none focus:border-gold-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Monthly Salary (₹)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  value={profileSalary}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => { const v = e.target.value; if (/^[0-9]*$/.test(v)) setProfileSalary(v === "" ? "" : Number(v)); }}
                  className="w-full bg-background border border-border rounded-xl py-2 px-3 text-foreground text-sm focus:outline-none focus:border-gold-500"
                />
              </div>

              <div>
                <label className="text-xs text-muted-foreground block mb-1">Family Debt Liability (₹)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  value={familyDebt}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => { const v = e.target.value; if (/^[0-9]*$/.test(v)) setFamilyDebt(v === "" ? "" : Number(v)); }}
                  className="w-full bg-background border border-border rounded-xl py-2 px-3 text-foreground text-sm focus:outline-none focus:border-gold-500"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-muted-foreground block mb-1">Freedom Target corpus (₹)</label>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="off"
                value={profileTarget}
                onFocus={(e) => e.target.select()}
                onChange={(e) => { const v = e.target.value; if (/^[0-9]*$/.test(v)) setProfileTarget(v === "" ? "" : Number(v)); }}
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

        {/* Budget Limits */}
        <BudgetLimitsCard budgetLimits={budgetLimits} setBudgetLimit={setBudgetLimit} removeBudgetLimit={removeBudgetLimit} />

        {/* App PIN Lock */}
        <AppPinCard />

        {/* Connect to Claude AI */}
        {user && <ClaudeConnectCard userId={user.id} isLocal={storageMode === 'local'} />}

        {/* UPI Auto-Read */}
        <div className="glass-card rounded-2xl p-6 border border-border space-y-4">
          <h4 className="text-base font-bold text-foreground mb-2 flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-gold-400" /> UPI Auto-Read
          </h4>
          {isNativePlatform() ? (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">Enable SMS Reading</p>
                  <p className="text-xs text-muted-foreground">Auto-detect UPI payments from SMS</p>
                </div>
                <button
                  onClick={() => {
                    const next = !upiAutoReadEnabled;
                    setUpiAutoReadEnabled(next);
                    localStorage.setItem('finfree_upi_autoread', next ? '1' : '0');
                  }}
                  className={`w-11 h-6 rounded-full transition-colors cursor-pointer ${upiAutoReadEnabled ? 'bg-primary' : 'bg-muted'}`}
                >
                  <div className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${upiAutoReadEnabled ? 'translate-x-[22px]' : 'translate-x-[2px]'}`} />
                </button>
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Default Account</label>
                <select
                  value={upiDefaultAccount}
                  onChange={e => { setUpiDefaultAccount(e.target.value); localStorage.setItem('finfree_upi_default_account', e.target.value); }}
                  className="w-full bg-background border border-border rounded-xl py-2 px-3 text-foreground text-sm"
                >
                  {accounts.map(acc => (
                    <option key={acc.id} value={acc.id}>{acc.name}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={() => setShowSmsImport(true)}
                className="w-full py-2.5 px-4 border border-border rounded-xl text-sm font-medium hover:bg-accent transition-colors cursor-pointer"
              >
                Scan SMS History (last 90 days)
              </button>
            </>
          ) : (
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Smartphone className="w-4 h-4" /> Available on Android app only
            </p>
          )}
        </div>

        {/* Notifications */}
        <div className="glass-card rounded-2xl p-6 border border-border space-y-4">
          <h4 className="text-base font-bold text-foreground mb-2 flex items-center gap-2">
            <Bell className="w-5 h-5 text-gold-400" /> Notifications
          </h4>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Budget Alerts</p>
              <p className="text-xs text-muted-foreground">Get notified when spending nears limits</p>
            </div>
            <button
              onClick={() => {
                const s = { ...notifSettings, budgetAlerts: !notifSettings.budgetAlerts };
                setNotifSettings(s);
                saveNotifSettingsFn(s);
                if (s.budgetAlerts) handleRequestNotifPerm();
              }}
              className={`w-11 h-6 rounded-full transition-colors cursor-pointer ${notifSettings.budgetAlerts ? 'bg-primary' : 'bg-muted'}`}
            >
              <div className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${notifSettings.budgetAlerts ? 'translate-x-[22px]' : 'translate-x-[2px]'}`} />
            </button>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Daily Spend Summary</p>
              <p className="text-xs text-muted-foreground">Evening recap of the day's spending</p>
            </div>
            <button
              onClick={() => {
                const s = { ...notifSettings, dailySummary: !notifSettings.dailySummary };
                setNotifSettings(s);
                saveNotifSettingsFn(s);
              }}
              className={`w-11 h-6 rounded-full transition-colors cursor-pointer ${notifSettings.dailySummary ? 'bg-primary' : 'bg-muted'}`}
            >
              <div className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${notifSettings.dailySummary ? 'translate-x-[22px]' : 'translate-x-[2px]'}`} />
            </button>
          </div>
          {notifSettings.dailySummary && (
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Summary Time</label>
              <select
                value={notifSettings.dailySummaryHour}
                onChange={e => {
                  const s = { ...notifSettings, dailySummaryHour: Number(e.target.value) };
                  setNotifSettings(s);
                  saveNotifSettingsFn(s);
                }}
                className="w-full bg-background border border-border rounded-xl py-2 px-3 text-foreground text-sm"
              >
                {Array.from({ length: 24 }, (_, i) => (
                  <option key={i} value={i}>{i === 0 ? '12 AM' : i < 12 ? `${i} AM` : i === 12 ? '12 PM' : `${i - 12} PM`}</option>
                ))}
              </select>
            </div>
          )}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Notification Sound</p>
            </div>
            <button
              onClick={() => {
                const s = { ...notifSettings, sound: !notifSettings.sound };
                setNotifSettings(s);
                saveNotifSettingsFn(s);
              }}
              className={`w-11 h-6 rounded-full transition-colors cursor-pointer ${notifSettings.sound ? 'bg-primary' : 'bg-muted'}`}
            >
              <div className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${notifSettings.sound ? 'translate-x-[22px]' : 'translate-x-[2px]'}`} />
            </button>
          </div>
          <button
            onClick={handleTestNotification}
            className="w-full py-2.5 px-4 border border-border rounded-xl text-sm font-medium hover:bg-accent transition-colors cursor-pointer"
          >
            Send Test Notification
          </button>
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

        {/* Currency */}
        <div className="glass-card rounded-2xl p-6 border border-border space-y-4">
          <h4 className="text-base font-bold text-foreground flex items-center gap-2">
            <span className="text-lg">{CURRENCIES.find(c => c.code === currency)?.symbol ?? '₹'}</span> Display Currency
          </h4>
          <p className="text-xs text-muted-foreground">All amounts across the app will display in the selected currency.</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {CURRENCIES.map(c => (
              <button
                key={c.code}
                onClick={() => setCurrency(c.code)}
                className={`p-3 rounded-xl border-2 text-left transition-all ${currency === c.code ? 'border-primary bg-primary/10' : 'border-border/50 bg-white/[0.02] hover:border-border'}`}
              >
                <p className={`text-sm font-bold ${currency === c.code ? 'text-primary' : 'text-foreground'}`}>{c.symbol} {c.code}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{c.name}</p>
              </button>
            ))}
          </div>
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

          {/* Web-only banner: shown when switching to local on a browser (not the native app) */}
          {showAppBanner && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/8 border border-amber-500/25">
              <Smartphone className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-amber-300 mb-1">Browser storage is temporary</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Local data in your browser can be cleared when you clear cookies or storage. For permanent offline access, install the FinFree app on your phone.
                </p>
                <div className="flex gap-2 mt-3">
                  {appDownloadUrl && (
                    <a
                      href={appDownloadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 text-black text-xs font-bold hover:bg-amber-400 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Install App
                    </a>
                  )}
                  <button
                    onClick={() => setShowAppBanner(false)}
                    className="px-3 py-1.5 rounded-lg bg-muted text-muted-foreground text-xs font-semibold hover:text-foreground transition-colors"
                  >
                    Continue in Browser
                  </button>
                </div>
              </div>
            </div>
          )}
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

        {/* App Capabilities */}
        <div className="glass-card rounded-2xl p-6 border border-border space-y-4 lg:col-span-2">
          <h4 className="text-base font-bold text-foreground flex items-center gap-2">
            <span className="text-lg">🚀</span> What You Can Do with FinFree
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { icon: "💰", title: "Track Accounts", desc: "Add bank accounts, wallets, cash — see all balances in one place" },
              { icon: "📊", title: "Income & Expenses", desc: "Log every transaction with categories, notes, and dates" },
              { icon: "📈", title: "Investments", desc: "Track mutual funds, stocks, gold, FDs — monitor returns" },
              { icon: "💳", title: "EMI Tracker", desc: "Add loans/EMIs, track payments, see remaining tenure" },
              { icon: "🎯", title: "Savings Goals", desc: "Set financial goals, track progress with visual bars" },
              { icon: "🔥", title: "Freedom Journey", desc: "Calculate when you'll be financially free based on your savings" },
              { icon: "📱", title: "Import Statements", desc: "Upload bank PDF statements to auto-import transactions" },
              { icon: "🔄", title: "Recurring Transactions", desc: "Mark SIPs and recurring payments — auto-created each month" },
              { icon: "📋", title: "Bulk Operations", desc: "Select all and delete multiple transactions at once" },
              { icon: "💾", title: "Export & Backup", desc: "Download full JSON backup or CSV export of transactions" },
              { icon: "🌐", title: "Cloud or Local", desc: "Choose cloud sync (multi-device) or offline-first local storage" },
              { icon: "🔒", title: "PIN Lock", desc: "Protect your app with a 4-digit PIN" },
            ].map(item => (
              <div key={item.title} className="flex items-start gap-3 p-3 rounded-xl bg-muted/20 border border-border">
                <span className="text-lg shrink-0">{item.icon}</span>
                <div>
                  <p className="text-xs font-semibold text-foreground">{item.title}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-4 border-t border-border">
            <h5 className="text-sm font-bold text-foreground flex items-center gap-2 mb-3">
              <Bot className="w-4 h-4 text-primary" /> Claude AI Integration
            </h5>
            <p className="text-xs text-muted-foreground mb-3">Connect to Claude AI and ask anything about your finances in natural language:</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                "\"What's my net worth?\"",
                "\"Add ₹500 for lunch today\"",
                "\"Show my spending breakdown for June\"",
                "\"How much did I spend on fuel this month?\"",
                "\"List my goals and progress\"",
                "\"Import these transactions from my statement\"",
                "\"Add a new EMI for my bike loan\"",
                "\"What's my savings rate this month?\"",
                "\"Show transactions for SBI account\"",
                "\"Delete the duplicate petrol entry\"",
              ].map(q => (
                <div key={q} className="px-3 py-2 rounded-lg bg-primary/5 border border-primary/10 text-[11px] text-primary/80 font-medium">
                  {q}
                </div>
              ))}
            </div>
          </div>
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

      {showSmsImport && <SmsHistoryImport onClose={() => setShowSmsImport(false)} />}
    </div>
  );
};
