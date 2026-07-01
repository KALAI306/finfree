import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useApp } from "../context/AppContext";
import {
  Home,
  ArrowUpDown,
  TrendingUp,
  Calendar,
  Flame,
  Target,
  ShieldCheck,
  BarChart3,
  User,
  LogOut,
  Database,
  Sun,
  Moon,
  Wallet,
  MoreHorizontal,
  X,
  Settings,
  Palette,
  Shield,
  Bot,
} from "lucide-react";
import { FloatingAiAssistant } from "./ui/glowing-ai-chat-assistant";
import { WelcomeTour } from "./WelcomeTour";

const THEME_COLORS = [
  { id: "gold",   label: "Gold",   cls: "theme-swatch-gold"   },
  { id: "green",  label: "Emerald",cls: "theme-swatch-green"  },
  { id: "blue",   label: "Blue",   cls: "theme-swatch-blue"   },
  { id: "purple", label: "Purple", cls: "theme-swatch-purple" },
  { id: "rose",   label: "Rose",   cls: "theme-swatch-rose"   },
] as const;

const navItems = [
  { path: "/",            label: "Dashboard",   icon: Home       },
  { path: "/accounts",   label: "Accounts",    icon: Wallet     },
  { path: "/transactions", label: "Transactions", icon: ArrowUpDown },
  { path: "/investments", label: "Investments", icon: TrendingUp },
  { path: "/emi",        label: "EMI",         icon: Calendar   },
  { path: "/freedom",    label: "Freedom",     icon: Flame      },
  { path: "/goals",      label: "Goals",       icon: Target     },
  { path: "/rules",      label: "Rules",       icon: ShieldCheck },
  { path: "/reports",    label: "Reports",     icon: BarChart3  },
  { path: "/ai-settings", label: "AI Settings", icon: Bot       },
];

// First 4 in bottom bar, rest in drawer
const mobileMain  = navItems.slice(0, 4);
const mobileExtra = navItems.slice(4);

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile, isAdmin, logout, theme, toggleTheme, profileImage, themeColor, setThemeColor, showWelcomeTour, dismissWelcomeTour, storageMode, lastRefreshed } = useApp();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background text-foreground relative">

      {/* ── Ambient background orbs ── */}
      {/* Aurora ambient background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10 select-none aurora-bg" aria-hidden="true" />

      {/* ────────────────────────────────────────
          DESKTOP SIDEBAR
      ──────────────────────────────────────── */}
      <aside className="hidden md:flex flex-col w-60 shrink-0 h-screen sticky top-0 sidebar transition-colors duration-200">

        {/* Logo */}
        <div className="flex items-center gap-3 px-5 pt-7 pb-6">
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shrink-0" style={{ boxShadow: "0 4px 16px hsl(var(--primary)/0.4)" }}>
            <Flame className="w-4.5 h-4.5 text-primary-foreground" strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-[17px] font-bold tracking-wide text-foreground leading-none m-0">FinFree</h1>
            <span className="text-[9px] text-primary font-semibold uppercase tracking-[0.18em] opacity-80">Freedom Tracker</span>
          </div>
        </div>

        {/* Connection status */}
        <div className="px-4 mb-5">
          {storageMode === 'cloud' ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-500/8 border border-emerald-500/15 text-[11px] text-emerald-400 font-medium">
              <Database className="w-3 h-3" />
              <span>Cloud · {lastRefreshed ? lastRefreshed.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : 'Syncing…'}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-500/8 border border-amber-500/15 text-[11px] text-amber-400 font-medium">
              <Database className="w-3 h-3" />
              <span>Local · {lastRefreshed ? lastRefreshed.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : 'Loading…'}</span>
            </div>
          )}
        </div>

        {/* Nav links */}
        <nav className="flex-1 px-3 space-y-0.5" role="navigation" aria-label="Main">
          {navItems.map(({ path, label, icon: Icon }) => {
            const active = isActive(path);
            return (
              <Link
                key={path}
                to={path}
                className={`nav-item ${active ? "active" : ""}`}
                aria-current={active ? "page" : undefined}
              >
                <Icon className={`w-[18px] h-[18px] shrink-0 transition-colors ${active ? "text-primary" : "text-muted-foreground"}`} />
                <span>{label}</span>
              </Link>
            );
          })}
          {isAdmin && (
            <Link
              to="/admin"
              className={`nav-item ${isActive("/admin") ? "active" : ""}`}
              aria-current={isActive("/admin") ? "page" : undefined}
            >
              <Shield className={`w-[18px] h-[18px] shrink-0 transition-colors ${isActive("/admin") ? "text-primary" : "text-amber-400"}`} />
              <span className="text-amber-400 font-semibold">Admin Panel</span>
            </Link>
          )}
        </nav>

        {/* User footer */}
        <div className="p-3 border-t border-border/50 space-y-2">
          <Link
            to="/settings"
            className="flex items-center gap-2.5 p-2.5 rounded-xl hover:bg-white/[0.04] transition-colors group"
            aria-label="Open Settings"
          >
            {profileImage ? (
              <img src={profileImage} className="w-8 h-8 rounded-full object-cover border border-border shrink-0" alt="Profile" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center font-bold text-primary-foreground text-xs uppercase shrink-0">
                {profile?.name?.charAt(0) || "K"}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground truncate m-0 leading-tight">{profile?.name || "Kalai"}</p>
              <p className="text-[10px] text-muted-foreground truncate m-0">Age {profile?.age || 23} · ₹{(profile?.monthly_salary || 20000).toLocaleString('en-IN')}/mo</p>
            </div>
            <Settings className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
          </Link>

          {/* Theme color picker */}
          <div className="px-1 py-2.5 rounded-xl border border-border/50 bg-white/[0.02]">
            <div className="flex items-center gap-1.5 mb-2 px-1">
              <Palette className="w-3 h-3 text-muted-foreground" />
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Accent Color</span>
            </div>
            <div className="flex items-center gap-2 px-1">
              {THEME_COLORS.map(({ id, label, cls }) => (
                <button
                  key={id}
                  onClick={() => setThemeColor(id)}
                  className={`theme-swatch ${cls} ${themeColor === id ? "active" : ""}`}
                  aria-label={`${label} theme`}
                  title={label}
                />
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={toggleTheme}
              className="flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-xl text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-white/[0.04] border border-border/50 transition-colors cursor-pointer"
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            >
              {theme === "dark"
                ? <Sun className="w-3.5 h-3.5 text-amber-400" />
                : <Moon className="w-3.5 h-3.5 text-blue-400" />}
              <span>{theme === "dark" ? "Light" : "Dark"}</span>
            </button>
            <button
              onClick={logout}
              className="flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-xl text-xs font-medium text-rose-400 hover:bg-rose-500/8 border border-rose-500/10 transition-colors cursor-pointer"
              aria-label="Log out"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Exit</span>
            </button>
          </div>
        </div>
      </aside>

      {/* ────────────────────────────────────────
          MOBILE TOP BAR
      ──────────────────────────────────────── */}
      <header className="md:hidden flex items-center justify-between px-4 py-3 sidebar border-b z-20 sticky top-0 transition-colors duration-200">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
            <Flame className="w-4 h-4 text-primary-foreground" strokeWidth={2.5} />
          </div>
          <span className="text-[17px] font-bold tracking-wide text-foreground leading-none">FinFree</span>
          {storageMode === 'cloud' ? (
            <span className="px-1.5 py-0.5 rounded text-[8px] font-bold tracking-wide uppercase bg-emerald-500/12 border border-emerald-500/20 text-emerald-400">
              LIVE
            </span>
          ) : (
            <span className="px-1.5 py-0.5 rounded text-[8px] font-bold tracking-wide uppercase bg-amber-500/12 border border-amber-500/20 text-amber-400">
              LOCAL
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={toggleTheme}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/[0.06] transition-colors cursor-pointer"
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === "dark"
              ? <Sun className="w-4 h-4 text-amber-400" />
              : <Moon className="w-4 h-4 text-blue-400" />}
          </button>
          <Link
            to="/settings"
            className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center border border-border hover:border-primary/40 transition-colors"
            aria-label="Settings"
          >
            {profileImage ? (
              <img src={profileImage} className="w-8 h-8 rounded-full object-cover" alt="Profile" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center font-bold text-primary-foreground text-xs uppercase">
                {profile?.name?.charAt(0) || "K"}
              </div>
            )}
          </Link>
        </div>
      </header>

      {/* ────────────────────────────────────────
          MAIN CONTENT
      ──────────────────────────────────────── */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto pb-24 md:pb-0 md:h-screen">
        <div className="p-4 md:p-7 max-w-7xl w-full mx-auto">
          {children}
        </div>
      </main>

      {/* ────────────────────────────────────────
          MOBILE BOTTOM NAV
      ──────────────────────────────────────── */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 sidebar border-t flex justify-around items-end pb-safe py-2 px-1"
        role="navigation"
        aria-label="Bottom navigation"
      >
        {mobileMain.map(({ path, label, icon: Icon }) => {
          const active = isActive(path);
          return (
            <Link
              key={path}
              to={path}
              className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all duration-200 min-w-[52px] cursor-pointer ${
                active ? "text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
              aria-label={label}
              aria-current={active ? "page" : undefined}
            >
              <div className={`relative flex items-center justify-center w-8 h-6 ${active ? "text-primary" : ""}`}>
                <Icon className="w-5 h-5" strokeWidth={active ? 2.2 : 1.8} />
                {active && (
                  <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
                )}
              </div>
              <span className={`text-[9px] mt-1 font-semibold tracking-wide ${active ? "text-primary" : ""}`}>
                {label}
              </span>
            </Link>
          );
        })}

        {/* More button */}
        <button
          onClick={() => setDrawerOpen(true)}
          className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all duration-200 min-w-[52px] cursor-pointer ${
            mobileExtra.some(i => isActive(i.path))
              ? "text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
          aria-label="More navigation options"
          aria-expanded={drawerOpen}
        >
          <div className="flex items-center justify-center w-8 h-6">
            <MoreHorizontal className="w-5 h-5" strokeWidth={1.8} />
          </div>
          <span className="text-[9px] mt-1 font-semibold tracking-wide">More</span>
        </button>
      </nav>

      {/* ────────────────────────────────────────
          MOBILE MORE DRAWER
      ──────────────────────────────────────── */}
      <FloatingAiAssistant />
      {showWelcomeTour && <WelcomeTour onClose={dismissWelcomeTour} />}

      {drawerOpen && (
        <div
          className="md:hidden fixed inset-0 z-50"
          role="dialog"
          aria-modal="true"
          aria-label="More navigation"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setDrawerOpen(false)}
          />

          {/* Sheet */}
          <div className="absolute bottom-0 left-0 right-0 sidebar border-t rounded-t-2xl p-5 shadow-2xl animate-pop-in">
            <div className="flex justify-between items-center pb-4 border-b border-border/50 mb-4">
              <span className="text-sm font-bold text-foreground tracking-wide">Navigate</span>
              <button
                onClick={() => setDrawerOpen(false)}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/[0.06] transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-4">
              {mobileExtra.map(({ path, label, icon: Icon }) => {
                const active = isActive(path);
                return (
                  <Link
                    key={path}
                    to={path}
                    onClick={() => setDrawerOpen(false)}
                    className={`flex flex-col items-center justify-center p-3.5 rounded-xl border transition-all cursor-pointer ${
                      active
                        ? "bg-primary/10 border-primary/30 text-primary"
                        : "border-border/60 bg-white/[0.03] text-muted-foreground hover:text-foreground hover:bg-white/[0.06]"
                    }`}
                  >
                    <Icon className={`w-5 h-5 ${active ? "text-primary" : ""}`} strokeWidth={1.8} />
                    <span className="text-[11px] mt-2 font-semibold text-center">{label}</span>
                  </Link>
                );
              })}
              <Link
                to="/settings"
                onClick={() => setDrawerOpen(false)}
                className={`flex flex-col items-center justify-center p-3.5 rounded-xl border transition-all cursor-pointer ${
                  isActive("/settings")
                    ? "bg-primary/10 border-primary/30 text-primary"
                    : "border-border/60 bg-white/[0.03] text-muted-foreground hover:text-foreground hover:bg-white/[0.06]"
                }`}
              >
                <User className="w-5 h-5" strokeWidth={1.8} />
                <span className="text-[11px] mt-2 font-semibold">Settings</span>
              </Link>
              {isAdmin && (
                <Link
                  to="/admin"
                  onClick={() => setDrawerOpen(false)}
                  className={`flex flex-col items-center justify-center p-3.5 rounded-xl border transition-all cursor-pointer ${
                    isActive("/admin")
                      ? "bg-amber-500/15 border-amber-500/40 text-amber-400"
                      : "border-amber-500/20 bg-amber-500/5 text-amber-400 hover:bg-amber-500/10"
                  }`}
                >
                  <Shield className="w-5 h-5" strokeWidth={1.8} />
                  <span className="text-[11px] mt-2 font-semibold">Admin</span>
                </Link>
              )}
            </div>

            {/* Theme color picker */}
            <div className="px-1 py-2.5 rounded-xl border border-border/50 bg-white/[0.02] mb-3">
              <div className="flex items-center gap-1.5 mb-2 px-1">
                <Palette className="w-3 h-3 text-muted-foreground" />
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Accent Color</span>
              </div>
              <div className="flex items-center gap-3 px-1">
                {THEME_COLORS.map(({ id, label, cls }) => (
                  <button
                    key={id}
                    onClick={() => setThemeColor(id)}
                    className={`theme-swatch ${cls} ${themeColor === id ? "active" : ""}`}
                    aria-label={`${label} theme`}
                    title={label}
                  />
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={toggleTheme}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-border/50 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-white/[0.04] transition-colors cursor-pointer"
              >
                {theme === "dark" ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-blue-400" />}
                {theme === "dark" ? "Light mode" : "Dark mode"}
              </button>
              <button
                onClick={() => { setDrawerOpen(false); logout(); }}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-rose-500/8 border border-rose-500/15 text-sm font-medium text-rose-400 hover:bg-rose-500/15 transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                Exit FinFree
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
