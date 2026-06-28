import React, { useState } from "react";
import { supabase, seedUserData } from "../lib/db";
import { useApp } from "../context/AppContext";
import { Flame, Mail, Lock, User, Eye, EyeOff, KeyRound } from "lucide-react";
import { Capacitor } from "@capacitor/core";

// On native (Android/iOS) use custom URL scheme so OAuth redirects back to the app
const getRedirectUrl = () =>
  Capacitor.isNativePlatform()
    ? "finfree://login-callback"
    : window.location.origin;

/* Google SVG icon */
const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M17.64 9.20455C17.64 8.56637 17.5827 7.95273 17.4764 7.36364H9V10.845H13.8436C13.635 11.97 13.0009 12.9232 12.0477 13.5614V15.8195H14.9564C16.6582 14.2527 17.64 11.9455 17.64 9.20455Z" fill="#4285F4"/>
    <path d="M9 18C11.43 18 13.4673 17.1941 14.9564 15.8195L12.0477 13.5614C11.2418 14.1014 10.2109 14.4205 9 14.4205C6.65591 14.4205 4.67182 12.8373 3.96409 10.71H0.957275V13.0418C2.43818 15.9832 5.48182 18 9 18Z" fill="#34A853"/>
    <path d="M3.96409 10.71C3.78409 10.17 3.68182 9.59318 3.68182 9C3.68182 8.40682 3.78409 7.83 3.96409 7.29V4.95818H0.957275C0.347727 6.17318 0 7.54773 0 9C0 10.4523 0.347727 11.8268 0.957275 13.0418L3.96409 10.71Z" fill="#FBBC05"/>
    <path d="M9 3.57955C10.3214 3.57955 11.5077 4.03364 12.4405 4.92545L15.0218 2.34409C13.4632 0.891818 11.4259 0 9 0C5.48182 0 2.43818 2.01682 0.957275 4.95818L3.96409 7.29C4.67182 5.16273 6.65591 3.57955 9 3.57955Z" fill="#EA4335"/>
  </svg>
);

type AuthMode = "login" | "signup" | "forgot";

const TermsModal: React.FC<{ type: "terms" | "privacy"; onClose: () => void }> = ({ type, onClose }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
    <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
    <div className="relative w-full max-w-md hero-card p-6 rounded-2xl max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
      <h2 className="text-lg font-bold mb-4">{type === "terms" ? "Terms of Service" : "Privacy Policy"}</h2>
      {type === "terms" ? (
        <div className="text-sm text-muted-foreground space-y-3">
          <p><strong className="text-foreground">1. Use of Service</strong> — FinFree is a personal finance tracker for individual use. You are responsible for the accuracy of your financial data.</p>
          <p><strong className="text-foreground">2. Data Storage</strong> — Your data is stored securely on Supabase. We do not sell or share your financial data with third parties.</p>
          <p><strong className="text-foreground">3. No Financial Advice</strong> — FinFree provides tracking tools only. Nothing in this app constitutes professional financial advice.</p>
          <p><strong className="text-foreground">4. Account Security</strong> — You are responsible for keeping your account credentials secure.</p>
          <p><strong className="text-foreground">5. Changes</strong> — We may update these terms. Continued use of the app constitutes acceptance.</p>
        </div>
      ) : (
        <div className="text-sm text-muted-foreground space-y-3">
          <p><strong className="text-foreground">Data We Collect</strong> — Email address, financial data you enter (transactions, goals, investments, EMIs), and profile information.</p>
          <p><strong className="text-foreground">How We Use It</strong> — Solely to provide the FinFree service to you. Your data is never sold or shared.</p>
          <p><strong className="text-foreground">Storage</strong> — Data is stored on Supabase with row-level security, meaning only you can access your data.</p>
          <p><strong className="text-foreground">Cookies</strong> — We use only essential cookies for authentication purposes.</p>
          <p><strong className="text-foreground">Your Rights</strong> — You can delete your account and all associated data at any time from Settings.</p>
        </div>
      )}
      <button onClick={onClose} className="mt-5 w-full btn-primary py-2.5 cursor-pointer">Close</button>
    </div>
  </div>
);

export const Auth: React.FC = () => {
  const { showToast } = useApp();
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [modal, setModal] = useState<"terms" | "privacy" | null>(null);
  const [resendLoading, setResendLoading] = useState(false);
  const [showResend, setShowResend] = useState(false);

  const isSignUp = mode === "signup";
  const isForgot = mode === "forgot";

  /* ── Google OAuth ── */
  const handleGoogleLogin = async () => {
    if (!supabase) {
      showToast("Supabase is not configured.", "warning");
      return;
    }
    setGoogleLoading(true);
    // Clear any stale demo mode so the OAuth callback always lands in Supabase mode
    localStorage.removeItem("finfree_mode");
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: getRedirectUrl(),
          queryParams: { access_type: "offline", prompt: "consent" },
        },
      });
      if (error) throw error;
      // Redirect happens automatically — no need to set state
    } catch (error: any) {
      console.error("Google auth error:", error);
      showToast(error.message || "Google sign-in failed", "error");
      setGoogleLoading(false);
    }
  };

  /* ── Forgot Password ── */
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) { showToast("Enter your email address", "warning"); return; }
    if (!supabase) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      showToast("Password reset link sent! Check your email.", "success");
      setMode("login");
    } catch (error: any) {
      showToast(error.message || "Failed to send reset email", "error");
    } finally {
      setLoading(false);
    }
  };

  /* ── Resend confirmation ── */
  const handleResend = async () => {
    if (!supabase || !email) return;
    setResendLoading(true);
    try {
      await supabase.auth.resend({ type: "signup", email });
      showToast("Confirmation email resent!", "success");
    } catch {
      showToast("Failed to resend", "error");
    } finally {
      setResendLoading(false);
    }
  };

  /* ── Email / Password ── */
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || (isSignUp && !name)) {
      showToast("Please fill in all fields", "warning");
      return;
    }
    if (!supabase) {
      showToast("Supabase is not configured.", "warning");
      return;
    }
    setLoading(true);
    setShowResend(false);
    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({ email, password,
          options: { data: { full_name: name } }
        });
        if (error) throw error;
        if (data.session) {
          // Email confirmation disabled — user is logged in immediately
          showToast("Account created! Welcome to FinFree.", "success");
        } else {
          showToast("Check your email to confirm your account.", "info");
          setMode("login");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        showToast("Welcome back!", "success");
      }
    } catch (error: any) {
      console.error("Auth error:", error);
      if (error.message?.toLowerCase().includes("email not confirmed")) {
        showToast("Please confirm your email first.", "warning");
        setShowResend(true);
      } else {
        showToast(error.message || "Authentication failed", "error");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden aurora-bg">

      {/* Decorative blobs */}
      <div
        className="absolute top-[-20%] right-[-10%] w-[55vw] h-[55vw] max-w-[600px] max-h-[600px] rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, hsl(var(--primary)/0.15) 0%, transparent 70%)", filter: "blur(60px)" }}
        aria-hidden="true"
      />
      <div
        className="absolute bottom-[-15%] left-[-10%] w-[45vw] h-[45vw] max-w-[500px] max-h-[500px] rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(16,185,129,0.08) 0%, transparent 70%)", filter: "blur(60px)" }}
        aria-hidden="true"
      />

      {/* Card */}
      <div className="w-full max-w-[420px] relative z-10 animate-fade-in-up">
        <div className="hero-card p-8 md:p-10">

          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
              style={{
                background: "linear-gradient(135deg, hsl(var(--primary)/0.9), hsl(var(--primary)))",
                boxShadow: "0 8px 32px hsl(var(--primary)/0.4)",
              }}
            >
              <Flame className="w-7 h-7 text-primary-foreground" strokeWidth={2.5} />
            </div>
            <h1 className="text-3xl font-bold text-foreground m-0 tracking-tight">FinFree</h1>
            <p className="text-[10px] text-primary font-semibold uppercase tracking-[0.22em] mt-1 opacity-80">
              Financial Freedom Tracker
            </p>
          </div>

          {/* Tab: Log In / Sign Up */}
          {!isForgot && (
            <div className="flex bg-white/[0.04] border border-white/[0.07] rounded-xl p-1 mb-6">
              {(["login", "signup"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => { setMode(m); setShowResend(false); }}
                  className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all cursor-pointer ${
                    mode === m ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {m === "login" ? "Log In" : "Sign Up"}
                </button>
              ))}
            </div>
          )}

          {/* Forgot Password heading */}
          {isForgot && (
            <div className="mb-6">
              <h2 className="text-xl font-bold text-foreground">Reset Password</h2>
              <p className="text-sm text-muted-foreground mt-1">Enter your email and we'll send a reset link.</p>
            </div>
          )}

          {/* Google Button — hidden on forgot password */}
          {!isForgot && (
            <>
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={googleLoading}
                className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl border border-white/[0.1] bg-white/[0.04] hover:bg-white/[0.08] text-foreground font-semibold text-sm transition-all cursor-pointer disabled:opacity-60 mb-5"
                style={{ backdropFilter: "blur(12px)" }}
              >
                {googleLoading ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <GoogleIcon />}
                {googleLoading ? "Redirecting to Google…" : "Continue with Google"}
              </button>
              <div className="flex items-center gap-3 mb-5">
                <div className="flex-1 h-px bg-white/[0.07]" />
                <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">or</span>
                <div className="flex-1 h-px bg-white/[0.07]" />
              </div>
            </>
          )}

          {/* Forgot Password form */}
          {isForgot ? (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div className="space-y-1.5">
                <label className="label-xs block">Email Address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input type="email" placeholder="kalai@example.com" value={email} onChange={e => setEmail(e.target.value)}
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl py-3 pl-10 pr-4 text-foreground text-sm focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all placeholder:text-muted-foreground/50" />
                </div>
              </div>
              <button type="submit" disabled={loading} className="w-full btn-primary py-3 cursor-pointer disabled:opacity-60">
                {loading ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <Mail className="w-4 h-4" />}
                {loading ? "Sending…" : "Send Reset Link"}
              </button>
              <button type="button" onClick={() => setMode("login")} className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer py-1">
                ← Back to Sign In
              </button>
            </form>
          ) : (
          <form onSubmit={handleAuth} className="space-y-4">
            {isSignUp && (
              <div className="space-y-1.5">
                <label className="label-xs block">Full Name</label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Kalai"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl py-3 pl-10 pr-4 text-foreground text-sm focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all placeholder:text-muted-foreground/50"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="label-xs block">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="email"
                  placeholder="kalai@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl py-3 pl-10 pr-4 text-foreground text-sm focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all placeholder:text-muted-foreground/50"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="label-xs block">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl py-3 pl-10 pr-11 text-foreground text-sm focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all placeholder:text-muted-foreground/50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full btn-primary py-3 mt-2 cursor-pointer disabled:opacity-60"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                <KeyRound className="w-4 h-4" />
              )}
              {loading ? "Please wait…" : isSignUp ? "Create Account" : "Sign In"}
            </button>

            {/* Forgot password link — only on login */}
            {!isSignUp && (
              <button type="button" onClick={() => { setMode("forgot"); setShowResend(false); }}
                className="w-full text-center text-xs text-muted-foreground hover:text-primary transition-colors cursor-pointer pt-1">
                Forgot your password?
              </button>
            )}

            {/* Resend confirmation */}
            {showResend && (
              <button type="button" onClick={handleResend} disabled={resendLoading}
                className="w-full text-center text-xs text-primary hover:underline cursor-pointer pt-1 disabled:opacity-60">
                {resendLoading ? "Sending…" : "Resend confirmation email"}
              </button>
            )}
          </form>
          )} {/* end isForgot conditional */}

          <p className="text-center text-[11px] text-muted-foreground mt-5 leading-relaxed">
            By continuing, you agree to our{" "}
            <span className="text-primary cursor-pointer hover:underline" onClick={() => setModal("terms")}>Terms</span>
            {" & "}
            <span className="text-primary cursor-pointer hover:underline" onClick={() => setModal("privacy")}>Privacy Policy</span>
          </p>

          {modal && <TermsModal type={modal} onClose={() => setModal(null)} />}
        </div>

        {!supabase && (
          <div className="mt-4 px-4 py-3 rounded-xl border border-amber-500/20 bg-amber-500/5 text-amber-400 text-xs text-center">
            Supabase is not connected — sign-in is unavailable.
          </div>
        )}
      </div>
    </div>
  );
};
