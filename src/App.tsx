import React, { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppProvider, useApp } from "./context/AppContext";
import { Layout } from "./components/Layout";
import { Auth } from "./pages/Auth";
import { Dashboard } from "./pages/Dashboard";
import { Transactions } from "./pages/Transactions";
import { Investments } from "./pages/Investments";
import { EmiManager } from "./pages/EmiManager";
import { FreedomCalculator } from "./pages/FreedomCalculator";
import { Goals } from "./pages/Goals";
import { RulesDashboard } from "./pages/RulesDashboard";
import { Reports } from "./pages/Reports";
import { Settings } from "./pages/Settings";
import { Accounts } from "./pages/Accounts";
import { AdminPanel } from "./pages/AdminPanel";
import { ResetPassword } from "./pages/ResetPassword";
import { StorageSetup } from "./pages/StorageSetup";
import { ToastContainer } from "./components/Toast";
import { Flame } from "lucide-react";
import { isFirstLaunch } from "./lib/storageMode";
import { Capacitor } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";
import { supabase } from "./lib/db";

const AppContent: React.FC = () => {
  const { user, loading } = useApp();
  const [setupDone, setSetupDone] = useState(() => !isFirstLaunch());

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

  return (
    <Routes>
      {/* Public route — accessible without login */}
      <Route path="/reset-password" element={<><ResetPassword /><ToastContainer /></>} />

      {/* Auth-gated routes */}
      {!user ? (
        <Route path="*" element={<><Auth /><ToastContainer /></>} />
      ) : (
        <Route path="/*" element={
          <Layout>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/accounts" element={<Accounts />} />
              <Route path="/transactions" element={<Transactions />} />
              <Route path="/investments" element={<Investments />} />
              <Route path="/emi" element={<EmiManager />} />
              <Route path="/freedom" element={<FreedomCalculator />} />
              <Route path="/goals" element={<Goals />} />
              <Route path="/rules" element={<RulesDashboard />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/admin" element={<AdminPanel />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Layout>
        } />
      )}
    </Routes>
  );
};

function App() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !supabase) return;

    // Listen for deep link when app is opened via finfree://login-callback
    CapApp.addListener("appUrlOpen", async ({ url }) => {
      if (url.startsWith("finfree://login-callback")) {
        // Convert custom scheme URL to something supabase can parse
        // Supabase puts tokens in the hash fragment: finfree://login-callback#access_token=...
        const hashOrQuery = url.includes("#") ? url.split("#")[1] : url.split("?")[1];
        if (hashOrQuery) {
          const params = new URLSearchParams(hashOrQuery);
          const accessToken = params.get("access_token");
          const refreshToken = params.get("refresh_token");
          if (accessToken && refreshToken) {
            await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
          }
          // PKCE flow: exchange code
          const code = params.get("code");
          if (code) {
            await supabase.auth.exchangeCodeForSession(code);
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
