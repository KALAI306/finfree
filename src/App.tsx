import React, { useState, useEffect, Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppProvider, useApp } from "./context/AppContext";
import { Layout } from "./components/Layout";
import { Auth } from "./pages/Auth";
import { Dashboard } from "./pages/Dashboard";
import { StorageSetup } from "./pages/StorageSetup";

// Route-level code splitting — keeps the initial bundle small so first paint
// and navigation stay snappy, especially on mid-range Android phones.
const Transactions      = lazy(() => import("./pages/Transactions").then(m => ({ default: m.Transactions })));
const Investments       = lazy(() => import("./pages/Investments").then(m => ({ default: m.Investments })));
const Markets           = lazy(() => import("./pages/Markets").then(m => ({ default: m.Markets })));
const EmiManager        = lazy(() => import("./pages/EmiManager").then(m => ({ default: m.EmiManager })));
const FreedomCalculator = lazy(() => import("./pages/FreedomCalculator").then(m => ({ default: m.FreedomCalculator })));
const Goals             = lazy(() => import("./pages/Goals").then(m => ({ default: m.Goals })));
const Budgets           = lazy(() => import("./pages/Budgets").then(m => ({ default: m.Budgets })));
const RulesDashboard    = lazy(() => import("./pages/RulesDashboard").then(m => ({ default: m.RulesDashboard })));
const Reports           = lazy(() => import("./pages/Reports").then(m => ({ default: m.Reports })));
const Settings          = lazy(() => import("./pages/Settings").then(m => ({ default: m.Settings })));
const AISettings        = lazy(() => import("./pages/AISettings").then(m => ({ default: m.AISettings })));
const Accounts          = lazy(() => import("./pages/Accounts").then(m => ({ default: m.Accounts })));
const AdminPanel        = lazy(() => import("./pages/AdminPanel").then(m => ({ default: m.AdminPanel })));
const ResetPassword     = lazy(() => import("./pages/ResetPassword").then(m => ({ default: m.ResetPassword })));
const TaxEstimator      = lazy(() => import("./pages/TaxEstimator").then(m => ({ default: m.TaxEstimator })));
import { ToastContainer } from "./components/Toast";
import { BiometricLock } from "./components/BiometricLock";
import { Flame } from "lucide-react";
import { isFirstLaunch } from "./lib/storageMode";
import { Capacitor } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { supabase } from "./lib/db";

const AppContent: React.FC = () => {
  const { user, loading, isAdmin } = useApp();
  const [setupDone, setSetupDone] = useState(() => !isFirstLaunch());
  const [biometricUnlocked, setBiometricUnlocked] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#02050e] flex flex-col items-center justify-center text-white">
        <div className="relative flex items-center justify-center">
          <div className="w-16 h-16 rounded-full border-4 border-violet-500/20 border-t-violet-600 animate-spin" />
          <Flame className="w-6 h-6 text-violet-400 absolute animate-pulse" />
        </div>
        <p className="text-xs font-bold uppercase tracking-widest text-violet-400/70 mt-6">
          FinFree is Loading...
        </p>
      </div>
    );
  }

  // Show storage mode picker on first ever launch
  if (!setupDone) {
    return <StorageSetup onDone={() => setSetupDone(true)} />;
  }

  // Biometric lock — shown to logged-in users until they authenticate
  if (user && !biometricUnlocked) {
    return <BiometricLock onUnlocked={() => setBiometricUnlocked(true)} />;
  }

  return (
    <Suspense
      fallback={
        <div className="min-h-[50vh] flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
        </div>
      }
    >
    <Routes>
      {/* Public route — accessible without login */}
      <Route path="/reset-password" element={<><ResetPassword /><ToastContainer /></>} />

      {/* Auth-gated routes */}
      {!user ? (
        <Route path="*" element={<><Auth /><ToastContainer /></>} />
      ) : (
        <Route path="/*" element={
          <Layout>
            <Suspense
              fallback={
                <div className="min-h-[50vh] flex items-center justify-center">
                  <div className="w-8 h-8 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
                </div>
              }
            >
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/accounts" element={<Accounts />} />
              <Route path="/transactions" element={<Transactions />} />
              <Route path="/investments" element={<Investments />} />
              <Route path="/markets" element={<Markets />} />
              <Route path="/emi" element={<EmiManager />} />
              <Route path="/freedom" element={<FreedomCalculator />} />
              <Route path="/goals" element={<Goals />} />
              <Route path="/budgets" element={<Budgets />} />
              <Route path="/rules" element={<RulesDashboard />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/tax" element={<TaxEstimator />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/ai-settings" element={isAdmin ? <AISettings /> : <Navigate to="/" replace />} />
              <Route path="/admin" element={<AdminPanel />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            </Suspense>
          </Layout>
        } />
      )}
    </Routes>
    </Suspense>
  );
};

function App() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !supabase) return;

    // Listen for deep link when app is opened via finfree://login-callback
    CapApp.addListener("appUrlOpen", async ({ url }) => {
      if (url.startsWith("finfree://login-callback")) {
        // Close the Capacitor browser tab first
        await Browser.close();

        const hashOrQuery = url.includes("#") ? url.split("#")[1] : url.split("?")[1];
        if (hashOrQuery) {
          const params = new URLSearchParams(hashOrQuery);
          const accessToken = params.get("access_token");
          const refreshToken = params.get("refresh_token");
          if (accessToken && refreshToken) {
            await supabase!.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
          }
          // PKCE flow: exchange code
          const code = params.get("code");
          if (code) {
            await supabase!.auth.exchangeCodeForSession(code);
          }
        }
      }
    });

    return () => { CapApp.removeAllListeners(); };
  }, []);

  return (
    <AppProvider>
      <BrowserRouter>
        <AppContent />
        <ToastContainer />
      </BrowserRouter>
    </AppProvider>
  );
}

export default App;
