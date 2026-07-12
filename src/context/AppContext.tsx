import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { formatCurrency } from "../lib/utils";
import {
  supabase,
  getProfile,
  getAccounts,
  getTransactions,
  getInvestments,
  getEmis,
  getGoals,
  updateProfile as dbUpdateProfile,
  addTransaction,
  getPreference,
  setPreference,
  getBudgets,
  setBudget as dbSetBudget,
  deleteBudget as dbDeleteBudget,
} from "../lib/db";
import type {
  Profile,
  Account,
  Transaction,
  Investment,
  EMI,
  Goal
} from "../lib/db";
import { localDb } from "../lib/localdb";
import { getStorageMode } from "../lib/storageMode";
import { migrateCloudToLocal } from "../lib/migration";
import { runSipAutoDebits } from "../lib/sip";
import { runBudgetCheck, initNotificationStore } from "../lib/budgetNotifyHook";
import confetti from "canvas-confetti";

export type ToastType = "success" | "warning" | "error" | "info";

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface AppContextType {
  user: any | null;
  profile: Profile | null;
  isAdmin: boolean;
  showWelcomeTour: boolean;
  dismissWelcomeTour: (profileData?: { name: string; age: string; monthly_salary: string; family_debt: string } | null) => void;
  accounts: Account[];
  transactions: Transaction[];
  investments: Investment[];
  emis: EMI[];
  goals: Goal[];
  loading: boolean;
  toasts: Toast[];
  showToast: (message: string, type: ToastType) => void;
  removeToast: (id: string) => void;
  refreshData: () => Promise<void>;
  logout: () => Promise<void>;
  updateUserProfile: (updates: Partial<Profile>) => Promise<void>;
  storageMode: 'local' | 'cloud';
  lastRefreshed: Date | null;
  budgetLimits: Record<string, number>;
  setBudgetLimit: (category: string, amount: number) => void;
  removeBudgetLimit: (category: string) => void;
  theme: "dark" | "light";
  toggleTheme: () => void;
  themeColor: "gold" | "green" | "blue" | "purple" | "rose";
  setThemeColor: (color: "gold" | "green" | "blue" | "purple" | "rose") => void;
  customCategories: { name: string; icon: string; type: "income" | "expense" }[];
  addCustomCategory: (name: string, icon: string, type: "income" | "expense") => void;
  editCustomCategory: (oldName: string, newName: string, newIcon: string) => void;
  deleteCustomCategory: (name: string) => void;
  customAccountTypes: string[];
  addCustomAccountType: (type: string) => void;
  customAssetTypes: string[];
  addCustomAssetType: (type: string) => void;
  starredAccountIds: string[];
  toggleStarAccount: (id: string) => void;
  profileImage: string;
  updateProfileImage: (url: string) => void;
  goalBgImages: Record<string, string>;
  updateGoalBgImage: (goalId: string, url: string) => void;
  currency: string;
  setCurrency: (code: string) => void;
  fmt: (amount: number, includeDecimals?: boolean) => string;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [emis, setEmis] = useState<EMI[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [showWelcomeTour, setShowWelcomeTour] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [storageMode, setStorageModeState] = useState<'local' | 'cloud'>(getStorageMode);
  const [budgetLimits, setBudgetLimitsState] = useState<Record<string, number>>(() => {
    try { return JSON.parse(localStorage.getItem('finfree_budget_limits') || '{}'); } catch { return {}; }
  });

  // Theme states
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [themeColor, setThemeColorState] = useState<"gold" | "green" | "blue" | "purple" | "rose">(() => {
    return (localStorage.getItem("finfree_theme_color") as any) || "gold";
  });

  // Currency
  const [currency, setCurrencyState] = useState<string>(() => {
    try { return localStorage.getItem('finfree_currency') || 'INR'; } catch { return 'INR'; }
  });

  const setCurrency = useCallback((code: string) => {
    setCurrencyState(code);
    try { localStorage.setItem('finfree_currency', code); } catch {}
  }, []);

  const fmt = useCallback((amount: number, includeDecimals = true) =>
    formatCurrency(amount, currency, includeDecimals), [currency]);

  // Profile and Goal image states — keyed per user to avoid cross-user bleed
  const [profileImage, setProfileImage] = useState<string>("");
  const [goalBgImages, setGoalBgImages] = useState<Record<string, string>>({});
  const [starredAccountIds, setStarredAccountIds] = useState<string[]>([]);
  const [customCategories, setCustomCategories] = useState<{ name: string; icon: string; type: "income" | "expense" }[]>([]);
  const [customAccountTypes, setCustomAccountTypes] = useState<string[]>([]);
  const [customAssetTypes, setCustomAssetTypes] = useState<string[]>([]);

  // Load all user-specific localStorage values when user changes
  useEffect(() => {
    if (!user?.id) {
      setProfileImage("");
      setGoalBgImages({});
      setStarredAccountIds([]);
      setCustomCategories([]);
      setCustomAccountTypes([]);
      setCustomAssetTypes([]);
      return;
    }
    const uid = user.id;
    setProfileImage(localStorage.getItem(`finfree_profile_image_${uid}`) || "");
    try { setGoalBgImages(JSON.parse(localStorage.getItem(`finfree_goal_bg_images_${uid}`) || "{}")); } catch { setGoalBgImages({}); }
    try { setStarredAccountIds(JSON.parse(localStorage.getItem(`finfree_starred_accounts_${uid}`) || "[]")); } catch { setStarredAccountIds([]); }
    try { setCustomCategories(JSON.parse(localStorage.getItem(`finfree_custom_categories_${uid}`) || "[]")); } catch { setCustomCategories([]); }
    try { setCustomAccountTypes(JSON.parse(localStorage.getItem(`finfree_custom_accounts_${uid}`) || "[]")); } catch { setCustomAccountTypes([]); }
    try { setCustomAssetTypes(JSON.parse(localStorage.getItem(`finfree_custom_assets_${uid}`) || "[]")); } catch { setCustomAssetTypes([]); }

    // Sync starred accounts from the preference store (cloud/local DB).
    // localStorage above is just a fast cache — the store is the source of truth.
    // If the store is empty but localStorage has values, migrate them up once.
    (async () => {
      try {
        const storedStarred = await getPreference<string[]>(uid, 'starred_accounts');
        if (storedStarred && storedStarred.length > 0) {
          setStarredAccountIds(storedStarred);
          localStorage.setItem(`finfree_starred_accounts_${uid}`, JSON.stringify(storedStarred));
        } else {
          const cached = JSON.parse(localStorage.getItem(`finfree_starred_accounts_${uid}`) || '[]');
          if (cached.length > 0) await setPreference(uid, 'starred_accounts', cached);
        }
      } catch (e) {
        console.warn('Preference sync failed (using local cache):', e);
      }
    })();

    // Load budgets from the relational budgets table (cloud Supabase / local IndexedDB).
    // One-time migration: if the table is empty but the old JSON preference/localStorage
    // had limits, write them into the new table so nobody loses existing budgets.
    (async () => {
      try {
        const rows = await getBudgets(uid);
        if (rows.length > 0) {
          const asRecord = Object.fromEntries(rows.map(r => [r.category, Number(r.monthly_limit)]));
          setBudgetLimitsState(asRecord);
          localStorage.setItem('finfree_budget_limits', JSON.stringify(asRecord));
        } else {
          let legacy: Record<string, number> = {};
          try {
            const fromPref = await getPreference<Record<string, number>>(uid, 'budget_limits');
            legacy = fromPref || JSON.parse(localStorage.getItem('finfree_budget_limits') || '{}');
          } catch {
            legacy = JSON.parse(localStorage.getItem('finfree_budget_limits') || '{}');
          }
          const entries = Object.entries(legacy).filter(([, v]) => Number(v) > 0);
          if (entries.length > 0) {
            await Promise.all(entries.map(([cat, limit]) => dbSetBudget(uid, cat, Number(limit))));
            setBudgetLimitsState(legacy);
            localStorage.setItem('finfree_budget_limits', JSON.stringify(legacy));
          }
        }
      } catch (e) {
        console.warn('Budget sync failed (using local cache):', e);
      }
    })();
  }, [user?.id]);

  const updateProfileImage = (url: string) => {
    if (!user?.id) return;
    setProfileImage(url);
    localStorage.setItem(`finfree_profile_image_${user.id}`, url);
    showToast("Profile image updated!", "success");
  };

  const updateGoalBgImage = (goalId: string, url: string) => {
    if (!user?.id) return;
    setGoalBgImages((prev) => {
      const updated = { ...prev, [goalId]: url };
      localStorage.setItem(`finfree_goal_bg_images_${user.id}`, JSON.stringify(updated));
      return updated;
    });
  };

  const toggleStarAccount = (id: string) => {
    if (!user?.id) return;
    setStarredAccountIds((prev) => {
      const updated = prev.includes(id)
        ? prev.filter((itemId) => itemId !== id)
        : [...prev, id];
      localStorage.setItem(`finfree_starred_accounts_${user.id}`, JSON.stringify(updated));
      setPreference(user.id, 'starred_accounts', updated).catch(() => {});
      showToast(prev.includes(id) ? "Account removed from favorites" : "Account starred!", "success");
      return updated;
    });
  };

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    localStorage.setItem("finfree_theme", nextTheme);
    if (nextTheme === "light") {
      document.documentElement.classList.add("light");
    } else {
      document.documentElement.classList.remove("light");
    }
  };

  const setThemeColor = (color: "gold" | "green" | "blue" | "purple" | "rose") => {
    setThemeColorState(color);
    localStorage.setItem("finfree_theme_color", color);
    document.documentElement.setAttribute("data-theme-color", color);
  };

  const addCustomCategory = (name: string, icon: string, type: "income" | "expense") => {
    if (!user?.id) return;
    const newCat = { name, icon, type };
    const updated = [...customCategories, newCat];
    setCustomCategories(updated);
    localStorage.setItem(`finfree_custom_categories_${user.id}`, JSON.stringify(updated));
    showToast(`Added custom category: ${name}`, "success");
  };

  const editCustomCategory = (oldName: string, newName: string, newIcon: string) => {
    if (!user?.id) return;
    const updated = customCategories.map(c => c.name === oldName ? { ...c, name: newName, icon: newIcon } : c);
    setCustomCategories(updated);
    localStorage.setItem(`finfree_custom_categories_${user.id}`, JSON.stringify(updated));
    showToast(`Updated category: ${newName}`, "success");
  };

  const deleteCustomCategory = (name: string) => {
    if (!user?.id) return;
    const updated = customCategories.filter(c => c.name !== name);
    setCustomCategories(updated);
    localStorage.setItem(`finfree_custom_categories_${user.id}`, JSON.stringify(updated));
    showToast(`Removed category: ${name}`, "info");
  };

  const addCustomAccountType = (type: string) => {
    if (!user?.id || customAccountTypes.includes(type)) return;
    const updated = [...customAccountTypes, type];
    setCustomAccountTypes(updated);
    localStorage.setItem(`finfree_custom_accounts_${user.id}`, JSON.stringify(updated));
    showToast(`Added custom account type: ${type}`, "success");
  };

  const addCustomAssetType = (type: string) => {
    if (!user?.id || customAssetTypes.includes(type)) return;
    const updated = [...customAssetTypes, type];
    setCustomAssetTypes(updated);
    localStorage.setItem(`finfree_custom_assets_${user.id}`, JSON.stringify(updated));
    showToast(`Added custom asset type: ${type}`, "success");
  };

  useEffect(() => {
    const savedTheme = localStorage.getItem("finfree_theme") || "dark";
    setTheme(savedTheme as any);
    if (savedTheme === "light") {
      document.documentElement.classList.add("light");
    } else {
      document.documentElement.classList.remove("light");
    }
    const savedColor = localStorage.getItem("finfree_theme_color") || "gold";
    document.documentElement.setAttribute("data-theme-color", savedColor);
  }, []);

  const autoCreateRecurring = async (userId: string) => {
    const key = `finfree_recurring_done_${userId}_${new Date().toISOString().slice(0, 7)}`;
    if (localStorage.getItem(key)) return;
    try {
      const mode = getStorageMode();
      let allTxs: any[];
      if (mode === 'local') {
        allTxs = await localDb.transactions.where('user_id').equals(userId).toArray();
      } else {
        if (!supabase) return;
        const { data } = await supabase.from('transactions').select('*').eq('user_id', userId);
        allTxs = data || [];
      }
      const recurring = allTxs.filter((t: any) => t.is_recurring);
      if (!recurring.length) return;

      const thisMonth = new Date().toISOString().slice(0, 7);
      const thisMonthTxs = allTxs.filter((t: any) => t.date?.startsWith(thisMonth));
      let created = 0;

      for (const r of recurring) {
        const alreadyExists = thisMonthTxs.some(
          (t: any) => t.category === r.category && t.amount === r.amount && t.is_recurring
        );
        if (!alreadyExists) {
          const today = new Date().toISOString().split('T')[0];
          await addTransaction({
            user_id: userId,
            account_id: r.account_id,
            type: r.type,
            amount: r.amount,
            category: r.category,
            note: r.note || r.description || '',
            date: today,
            is_recurring: true,
            transfer_to_account_id: r.transfer_to_account_id || null,
          });
          created++;
        }
      }
      localStorage.setItem(key, '1');
      if (created > 0) {
        showToast(`Auto-created ${created} recurring transaction${created > 1 ? 's' : ''} for this month`, 'info');
      }
    } catch (e) {
      console.warn('Auto-recurring failed:', e);
    }
  };

  const setBudgetLimit = (category: string, amount: number) => {
    const updated = { ...budgetLimits, [category]: amount };
    setBudgetLimitsState(updated);
    localStorage.setItem('finfree_budget_limits', JSON.stringify(updated));
    if (user?.id) dbSetBudget(user.id, category, amount).catch(() => showToast('Failed to save budget — will retry next load', 'error'));
  };

  const removeBudgetLimit = (category: string) => {
    const updated = { ...budgetLimits };
    delete updated[category];
    setBudgetLimitsState(updated);
    localStorage.setItem('finfree_budget_limits', JSON.stringify(updated));
    if (user?.id) dbDeleteBudget(user.id, category).catch(() => {});
  };

  const showToast = (message: string, type: ToastType) => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      removeToast(id);
    }, 5000);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const refreshData = async (targetUserId?: string) => {
    const uId = targetUserId ?? user?.id;
    if (!uId) return;
    try {
      const mode = getStorageMode();

      let profData: Profile, accData: Account[], txData: Transaction[],
          invData: Investment[], emiData: EMI[], goalData: Goal[];

      if (mode === 'local') {
        // Read from IndexedDB (Dexie)
        const [prof, accs, txs, invs, emis, goals] = await Promise.all([
          localDb.profiles.get(uId),
          localDb.accounts.where('user_id').equals(uId).toArray(),
          localDb.transactions.where('user_id').equals(uId).toArray(),
          localDb.investments.where('user_id').equals(uId).toArray(),
          localDb.emis.where('user_id').equals(uId).toArray(),
          localDb.goals.where('user_id').equals(uId).toArray(),
        ]);
        profData = (prof || { id: uId, name: 'You', age: 25, monthly_salary: 0, freedom_target: 10000000, target_freedom_age: 50, family_debt: 0, is_admin: false, created_at: new Date().toISOString() }) as unknown as Profile;
        accData = accs as Account[];
        txData = txs as Transaction[];
        invData = invs as Investment[];
        emiData = emis as unknown as EMI[];
        goalData = goals as Goal[];
      } else {
        // Read from Supabase (cloud) — check connectivity first
        if (!navigator.onLine) {
          showToast("You're offline. Showing last loaded data.", "warning");
          return;
        }
        [profData, accData, txData, invData, emiData, goalData] = await Promise.all([
          getProfile(uId),
          getAccounts(uId),
          getTransactions(uId),
          getInvestments(uId),
          getEmis(uId),
          getGoals(uId)
        ]);
      }

      setProfile(profData);
      setAccounts(accData);
      setTransactions(txData);
      setInvestments(invData);
      setEmis(emiData);
      setGoals(goalData);
      setLastRefreshed(new Date());
      setStorageModeState(getStorageMode());

      // Run budget check on data load
      initNotificationStore(user?.id);
      const budgetArr = Object.entries(budgetLimits).map(([category, monthly_limit]) => ({ category, monthly_limit }));
      runBudgetCheck(budgetArr, txData, currency, user?.id);

      // Save monthly net worth snapshot to Dexie
      try {
        const liquid = accData.reduce((s, a) => s + Number(a.balance), 0);
        const invested = invData.reduce((s, i) => s + Number(i.current_value), 0);
        const debt = profData ? Number(profData.family_debt) : 0;
        const currentNW = liquid + invested - debt;
        const month = new Date().toISOString().slice(0, 7);
        await localDb.networth_snapshots.put({
          id: `${uId}_${month}`,
          user_id: uId,
          month,
          net_worth: currentNW,
          liquid_cash: liquid,
          invested,
          debt,
          recorded_at: new Date().toISOString(),
        });

        // Backfill historical snapshots from transaction history (one-time seed)
        const existingSnaps = await localDb.networth_snapshots.where('user_id').equals(uId).toArray();
        if (existingSnaps.length < 2 && txData.length > 0) {
          // Group transactions by month
          const byMonth: Record<string, { income: number; expense: number }> = {};
          for (const tx of txData) {
            const m = (tx.date || '').slice(0, 7);
            if (!m || m === month) continue;
            if (!byMonth[m]) byMonth[m] = { income: 0, expense: 0 };
            if (tx.type === 'income') byMonth[m].income += Number(tx.amount);
            else if (tx.type === 'expense') byMonth[m].expense += Number(tx.amount);
          }
          const pastMonths = Object.keys(byMonth).sort().reverse(); // newest-first
          let nw = currentNW;
          for (const m of pastMonths) {
            // Reverse this month's effect to get the NW at start of that month
            const { income, expense } = byMonth[m];
            nw = nw - income + expense;
            const snapId = `${uId}_${m}`;
            const exists = await localDb.networth_snapshots.get(snapId);
            if (!exists) {
              await localDb.networth_snapshots.put({
                id: snapId,
                user_id: uId,
                month: m,
                net_worth: nw,
                liquid_cash: nw > 0 ? nw : 0,
                invested: 0,
                debt,
                recorded_at: new Date().toISOString(),
              });
            }
          }
        }
      } catch { /* non-critical */ }

      evaluateFinancialAlerts(profData, emiData, goalData);
    } catch (err: any) {
      console.error("Error refreshing data:", err);
      if (!navigator.onLine || err?.message?.includes('fetch')) {
        showToast("You're offline. Check your internet connection.", "warning");
      } else {
        showToast("Failed to refresh financial details", "error");
      }
    }
  };

  // Evaluate warning triggers
  const evaluatedAlerts = React.useRef<Record<string, boolean>>({});
  const evaluateFinancialAlerts = (
    prof: Profile,
    currentEmis: EMI[],
    currentGoals: Goal[]
  ) => {
    // 1. EMI ratio check
    const totalEmi = currentEmis.reduce((sum, e) => sum + Number(e.emi_amount), 0);
    const emiRatio = prof.monthly_salary > 0 ? (totalEmi / prof.monthly_salary) * 100 : 0;
    if (emiRatio > 15) {
      const key = `emi-warning-${totalEmi}`;
      if (!evaluatedAlerts.current[key]) {
        showToast(`⚠️ EMI is now ${emiRatio.toFixed(1)}% of salary (Limit: 15%)`, "warning");
        evaluatedAlerts.current[key] = true;
      }
    }

    // 2. Goal completion checks
    currentGoals.forEach(g => {
      const progress = g.target_amount > 0 ? (Number(g.current_amount) / Number(g.target_amount)) * 100 : 0;
      if (progress >= 100) {
        const key = `goal-done-${g.id}-${g.current_amount}`;
        if (!evaluatedAlerts.current[key]) {
          showToast(`🎉 ${g.name} Goal Complete!`, "success");
          confetti({
            particleCount: 150,
            spread: 80,
            origin: { y: 0.6 }
          });
          evaluatedAlerts.current[key] = true;
        }
      }
    });
  };

  const updateUserProfile = async (updates: Partial<Profile>) => {
    if (!profile) return;
    try {
      const updated = await dbUpdateProfile({ ...updates, id: profile.id });
      setProfile(updated);
      showToast("Profile settings saved successfully", "success");
    } catch (err) {
      console.error(err);
      showToast("Failed to update profile", "error");
    }
  };

  const logout = async () => {
    setLoading(true);
    if (supabase) {
      await supabase.auth.signOut();
    }
    setUser(null);
    setProfile(null);
    setAccounts([]);
    setTransactions([]);
    setInvestments([]);
    setEmis([]);
    setGoals([]);
    setLoading(false);
    showToast("Logged out successfully", "info");
  };

  useEffect(() => {
    let unsubscribe: any = null;

    const initAuth = async () => {
      setLoading(true);

      if (supabase) {
        const { data: { session } } = await supabase.auth.getSession();

        if (session?.user) {
          setUser(session.user);
        } else {
          setUser(null);
        }

        const { data: { subscription } } = supabase.auth.onAuthStateChange(
          async (event, session) => {
            if (session?.user) {
              setProfile(null);
              setAccounts([]);
              setTransactions([]);
              setInvestments([]);
              setEmis([]);
              setGoals([]);
              setUser(session.user);
            } else if (event === "SIGNED_OUT") {
              setUser(null);
            }
          }
        );
        unsubscribe = subscription.unsubscribe;
      } else {
        setUser(null);
      }
      setLoading(false);
    };

    initAuth();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (user) {
      const runDataLoad = async () => {
        if (getStorageMode() === 'local') {
          const migrated = await migrateCloudToLocal(user.id);
          if (migrated) {
            showToast('Your cloud data has been synced locally!', 'success');
          }
        }
        await refreshData(user.id);
        // Auto-create recurring transactions for this month if not yet created
        await autoCreateRecurring(user.id);
        // Auto-debit any SIPs that are due and linked to an account
        try {
          const done = await runSipAutoDebits(user.id, addTransaction);
          if (done > 0) {
            showToast(`Auto-debited ${done} SIP${done > 1 ? 's' : ''} for this month`, 'info');
            await refreshData(user.id);
          }
        } catch (e) {
          console.warn('SIP auto-debit run failed:', e);
        }
      };
      runDataLoad();
    }
  }, [user]);

  // Show tour only for new users (no name set in profile yet)
  useEffect(() => {
    if (profile !== null && !profile.name) {
      setShowWelcomeTour(true);
    }
  }, [profile?.name]);

  const dismissWelcomeTour = async (
    profileData?: { name: string; age: string; monthly_salary: string; family_debt: string } | null
  ) => {
    setShowWelcomeTour(false);
    if (profileData?.name && profile) {
      try {
        const updated = await dbUpdateProfile({
          id: profile.id,
          name: profileData.name.trim(),
          age: profileData.age ? Number(profileData.age) : undefined,
          monthly_salary: profileData.monthly_salary ? Number(profileData.monthly_salary) : undefined,
          family_debt: profileData.family_debt ? Number(profileData.family_debt) : undefined,
        });
        setProfile(updated);
      } catch (e) {
        console.error('Tour profile save failed:', e);
      }
    }
  };

  return (
    <AppContext.Provider
      value={{
        user,
        profile,
        isAdmin: profile?.is_admin ?? false,
        showWelcomeTour,
        dismissWelcomeTour,
        accounts,
        transactions,
        investments,
        emis,
        goals,
        loading,
        toasts,
        showToast,
        removeToast,
        refreshData,
        logout,
        updateUserProfile,
        theme,
        toggleTheme,
        themeColor,
        setThemeColor,
        customCategories,
        addCustomCategory,
        editCustomCategory,
        deleteCustomCategory,
        customAccountTypes,
        addCustomAccountType,
        customAssetTypes,
        addCustomAssetType,
        starredAccountIds,
        toggleStarAccount,
        profileImage,
        updateProfileImage,
        goalBgImages,
        updateGoalBgImage,
        storageMode,
        lastRefreshed,
        budgetLimits,
        setBudgetLimit,
        removeBudgetLimit,
        currency,
        setCurrency,
        fmt,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error("useApp must be used within an AppProvider");
  }
  return context;
};
