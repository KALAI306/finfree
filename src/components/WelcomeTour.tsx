import React, { useState } from "react";
import { Flame, Wallet, ArrowUpDown, TrendingUp, Target, ChevronRight, X } from "lucide-react";

const STEPS = [
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

interface WelcomeTourProps {
  onClose: () => void;
}

export const WelcomeTour: React.FC<WelcomeTourProps> = ({ onClose }) => {
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  const Icon = current.icon;
  const isLast = step === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
      <div className="hero-card p-8 max-w-sm w-full relative animate-fade-in-up">
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          aria-label="Skip tour"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Step icon */}
        <div className={`w-16 h-16 rounded-2xl ${current.bg} flex items-center justify-center mx-auto mb-6`}>
          <Icon className={`w-8 h-8 ${current.color}`} strokeWidth={1.8} />
        </div>

        {/* Content */}
        <h2 className="text-xl font-bold text-foreground text-center mb-3">{current.title}</h2>
        <p className="text-sm text-muted-foreground text-center leading-relaxed mb-8">{current.desc}</p>

        {/* Dots */}
        <div className="flex justify-center gap-1.5 mb-6">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === step ? "w-6 bg-primary" : "w-1.5 bg-muted-foreground/30"
              }`}
            />
          ))}
        </div>

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
            onClick={() => isLast ? onClose() : setStep(s => s + 1)}
            className="flex-1 btn-primary py-2.5 flex items-center justify-center gap-1.5 cursor-pointer"
          >
            {isLast ? "Get Started!" : (
              <>Next <ChevronRight className="w-4 h-4" /></>
            )}
          </button>
        </div>

        {!isLast && (
          <button
            onClick={onClose}
            className="w-full text-center text-xs text-muted-foreground hover:text-foreground mt-3 transition-colors cursor-pointer"
          >
            Skip tour
          </button>
        )}
      </div>
    </div>
  );
};
