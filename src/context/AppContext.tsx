import React, { createContext, useContext, useState, useEffect } from "react";
import {
  supabase,
  getProfile,
  getAccounts,
  getTransactions,
  getInvestments,
  getEmis,
  getGoals,
  updateProfile as dbUpdateProfile
} from "../lib/db";
import type { 
  Profile, 
  Account, 
  Transaction, 
  Investment, 
  EMI, 
  Goal 
} from "../lib/db";
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
  dismissWelcomeTour: () => void;
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
  theme: "dark" | "light";
  toggleTheme: () => void;
  themeColor: "gold" | "green" | "blue" | "purple" | "rose";
  setThemeColor: (color: "gold" | "green" | "blue" | "purple" | "rose") => void;
  customCategories: { name: string; icon: string; type: "income" | "expense" }[];
  addCustomCategory: (name: string, icon: string, type: "income" | "expense") => void;
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

  // Theme states
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [themeColor, setThemeColorState] = useState<"gold" | "green" | "blue" | "purple" | "rose">(() => {
    return (localStorage.getItem("finfree_theme_color") as any) || "gold";
  });

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
      const [profData, accData, txData, invData, emiData, goalData] = await Promise.all([
        getProfile(uId),
        getAccounts(uId),
        getTransactions(uId),
        getInvestments(uId),
        getEmis(uId),
        getGoals(uId)
      ]);

      setProfile(profData);
      setAccounts(accData);
      setTransactions(txData);
      setInvestments(invData);
      setEmis(emiData);
      setGoals(goalData);

      // Rule evaluations for alerts (Triggered on data updates)
      evaluateFinancialAlerts(profData, emiData, goalData);
    } catch (err) {
      console.error("Error refreshing dashboard data:", err);
      showToast("Failed to refresh financial details", "error");
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
              // Clear previous user's data immediately so stale data never shows for the new user
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
            // Ignore other null-session events (TOKEN_REFRESHED failures, OAuth redirects)
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
      refreshData(user.id);
      // Show welcome tour once per user
      const key = `finfree_welcomed_${user.id}`;
      if (!localStorage.getItem(key)) {
        setShowWelcomeTour(true);
      }
    }
  }, [user]);

  const dismissWelcomeTour = () => {
    if (user?.id) {
      localStorage.setItem(`finfree_welcomed_${user.id}`, "1");
    }
    setShowWelcomeTour(false);
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
        customAccountTypes,
        addCustomAccountType,
        customAssetTypes,
        addCustomAssetType,
        starredAccountIds,
        toggleStarAccount,
        profileImage,
        updateProfileImage,
        goalBgImages,
        updateGoalBgImage
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
