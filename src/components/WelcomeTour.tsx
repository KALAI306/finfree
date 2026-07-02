import React, { useState } from "react";
import { Flame, Wallet, ArrowUpDown, TrendingUp, Target, ChevronRight, X, User } from "lucide-react";

const INFO_STEPS = [
  {
    icon: Flame,
    title: "Welcome to FinFree!",
    desc: "Your personal Financial Freedom Tracker. Let's take a quick look at what you can do here.",
    color: "text-primary",
    bg: "bg-primary/10",
  },
  {
    icon: Wallet,
    title: "Add Your Accounts",
    desc: "Start by adding your bank accounts (SBI, IOB, PayTM, Cash…). They'll show up on your dashboard with live balances.",
    color: "text-blue-400",
    bg: "bg-blue-500/10",
  },
  {
    icon: ArrowUpDown,
    title: "Track Transactions",
    desc: "Log income and expenses to see where your money goes. You can also import bank statements automatically.",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
  },
  {
    icon: TrendingUp,
    title: "Grow Investments",
    desc: "Track your SIPs, stocks, gold, and other investments. Watch your wealth grow over time.",
    color: "text-violet-400",
    bg: "bg-violet-500/10",
  },
  {
    icon: Target,
    title: "Set Freedom Goals",
    desc: "Define your Financial Freedom target. FinFree will calculate exactly when you'll reach it based on your savings rate.",
    color: "text-amber-400",
    bg: "bg-amber-500/10",
  },
];

export interface TourProfileData {
  name: string;
  age: string;
  monthly_salary: string;
  family_debt: string;
}

interface WelcomeTourProps {
  onComplete: (profile: TourProfileData | null) => void;
}

export const WelcomeTour: React.FC<WelcomeTourProps> = ({ onComplete }) => {
  const [step, setStep]   = useState(0);
  const [profile, setProfile] = useState<TourProfileData>({ name: '', age: '', monthly_salary: '', family_debt: '' });

  const totalSteps = INFO_STEPS.length + 1; // +1 for profile step
  const isProfileStep = step === INFO_STEPS.length;
  const isLast = step === totalSteps - 1;

  const current = !isProfileStep ? INFO_STEPS[step] : null;
  const Icon    = current?.icon ?? User;

  const handleNext = () => {
    if (isLast) {
      onComplete(profile.name.trim() ? profile : null);
    } else {
      setStep(s => s + 1);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
      <div className="hero-card p-6 md:p-8 max-w-sm w-full relative animate-fade-in-up">
        {/* Close / skip */}
        <button
          onClick={() => onComplete(null)}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          aria-label="Skip tour"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Step indicator */}
        <div className="flex justify-center gap-1.5 mb-5">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${i === step ? 'w-6 bg-primary' : i < step ? 'w-3 bg-primary/40' : 'w-1.5 bg-muted-foreground/25'}`}
            />
          ))}
        </div>

        {!isProfileStep ? (
          /* ── Info step ── */
          <>
            <div className={`w-14 h-14 rounded-2xl ${current!.bg} flex items-center justify-center mx-auto mb-5`}>
              <Icon className={`w-7 h-7 ${current!.color}`} strokeWidth={1.8} />
            </div>
            <h2 className="text-xl font-bold text-foreground text-center mb-2">{current!.title}</h2>
            <p className="text-sm text-muted-foreground text-center leading-relaxed mb-7">{current!.desc}</p>
          </>
        ) : (
          /* ── Profile setup step ── */
          <>
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-5">
              <User className="w-7 h-7 text-primary" strokeWidth={1.8} />
            </div>
            <h2 className="text-xl font-bold text-foreground text-center mb-1">Set Up Your Profile</h2>
            <p className="text-xs text-muted-foreground text-center mb-5">Help FinFree personalize your experience</p>
            <div className="space-y-3 mb-6">
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Your Name *</label>
                <input
                  type="text"
                  value={profile.name}
                  onChange={e => setProfile(p => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Kalai"
                  className="w-full bg-background border border-border rounded-xl py-2.5 px-3 text-sm text-foreground focus:outline-none focus:border-primary/60"
                  autoFocus
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Age</label>
                  <input
                    type="number"
                    value={profile.age}
                    onChange={e => setProfile(p => ({ ...p, age: e.target.value }))}
                    placeholder="21"
                    min={10} max={80}
                    className="w-full bg-background border border-border rounded-xl py-2.5 px-3 text-sm text-foreground focus:outline-none focus:border-primary/60"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Monthly Salary (₹)</label>
                  <input
                    type="number"
                    value={profile.monthly_salary}
                    onChange={e => setProfile(p => ({ ...p, monthly_salary: e.target.value }))}
                    placeholder="20000"
                    className="w-full bg-background border border-border rounded-xl py-2.5 px-3 text-sm text-foreground focus:outline-none focus:border-primary/60"
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Total Debt / Loans (₹)</label>
                <input
                  type="number"
                  value={profile.family_debt}
                  onChange={e => setProfile(p => ({ ...p, family_debt: e.target.value }))}
                  placeholder="0"
                  className="w-full bg-background border border-border rounded-xl py-2.5 px-3 text-sm text-foreground focus:outline-none focus:border-primary/60"
                />
              </div>
            </div>
          </>
        )}

        {/* Buttons */}
        <div className="flex gap-3">
          {step > 0 && (
            <button
              onClick={() => setStep(s => s - 1)}
              className="flex-1 py-2.5 text-sm font-semibold border border-border rounded-xl text-foreground hover:bg-muted transition-colors cursor-pointer"
            >
              Back
            </button>
          )}
          <button
            onClick={handleNext}
            disabled={isProfileStep && !profile.name.trim()}
            className="flex-1 btn-primary py-2.5 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {isLast ? 'Get Started!' : (<>Next <ChevronRight className="w-4 h-4" /></>)}
          </button>
        </div>

        {!isLast && (
          <button
            onClick={() => onComplete(null)}
            className="w-full text-center text-xs text-muted-foreground hover:text-foreground mt-3 transition-colors cursor-pointer"
          >
            Skip tour
          </button>
        )}
      </div>
    </div>
  );
};
