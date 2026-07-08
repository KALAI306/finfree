import React, { useState, useEffect } from "react";
import { useApp } from "../context/AppContext";
import { addEmi, updateEmi, deleteEmi, addTransaction } from "../lib/db";
import { addMonths, format, differenceInDays } from "date-fns";
import {
  Plus,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Trash2,
  Edit2,
  Sparkles,
  CalendarDays,
  Coins,
  TrendingDown,
  Info,
  ChevronDown,
} from "lucide-react";
import { Modal } from "../components/Modal";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import type { EMI } from "../lib/db";
import { CustomSelect, NumberInput } from "../components/CustomSelect";

// ── Snowball vs Avalanche Simulation ─────────────────────────────────────────

interface SimLoan {
  id: string;
  name: string;
  balance: number;
  rate: number;   // monthly fraction
  minPayment: number;
}

interface SimResult {
  totalMonths: number;
  totalInterest: number;
  payoffOrder: { name: string; month: number }[];
  monthlySchedule: { month: number; totalBalance: number }[];
}

function runSimulation(loans: SimLoan[], extraPayment: number, strategy: "snowball" | "avalanche"): SimResult {
  // Deep-clone balances
  let active = loans.map(l => ({ ...l }));
  let month = 0;
  let totalInterest = 0;
  const payoffOrder: { name: string; month: number }[] = [];
  const monthlySchedule: { month: number; totalBalance: number }[] = [];
  let freed = 0; // extra freed up from paid-off loans gets added back

  while (active.length > 0 && month < 600) {
    month++;
    // Pick target loan
    const sorted = [...active].sort((a, b) =>
      strategy === "snowball" ? a.balance - b.balance : b.rate - a.rate,
    );
    const targetId = sorted[0].id;

    let remainingExtra = extraPayment + freed;
    freed = 0;

    active = active.map(loan => {
      const interest = loan.balance * loan.rate;
      totalInterest += interest;
      const payment = loan.minPayment + (loan.id === targetId ? remainingExtra : 0);
      const principal = Math.min(loan.balance, Math.max(0, payment - interest));
      return { ...loan, balance: Math.max(0, loan.balance - principal) };
    });

    // Remove paid-off loans and free their min payment
    const stillActive: SimLoan[] = [];
    for (const loan of active) {
      if (loan.balance < 0.5) {
        payoffOrder.push({ name: loan.name, month });
        freed += loan.minPayment;
      } else {
        stillActive.push(loan);
      }
    }
    active = stillActive;

    const totalBal = active.reduce((s, l) => s + l.balance, 0);
    if (month <= 120) monthlySchedule.push({ month, totalBalance: totalBal });
  }

  return { totalMonths: month, totalInterest, payoffOrder, monthlySchedule };
}

const SnowballAvalanchePlanner: React.FC<{
  emis: any[];
  extraPayment: number;
  fmt: (n: number) => string;
}> = ({ emis, extraPayment, fmt }) => {
  const loans: SimLoan[] = emis.map(emi => {
    const P = Number(emi.principal);
    const rate = Number(emi.interest_rate) / 100 / 12;
    const PMT = Number(emi.emi_amount);
    const paid = Number(emi.paid_months);
    let balance = P;
    if (rate > 0) {
      balance = P * Math.pow(1 + rate, paid) - PMT * ((Math.pow(1 + rate, paid) - 1) / rate);
    } else {
      balance = P - PMT * paid;
    }
    balance = Math.max(0, balance);
    return { id: emi.id, name: emi.name, balance, rate, minPayment: PMT };
  });

  const snowball  = runSimulation(loans, extraPayment, "snowball");
  const avalanche = runSimulation(loans, extraPayment, "avalanche");

  const interestDiff = snowball.totalInterest - avalanche.totalInterest;
  const monthDiff    = snowball.totalMonths   - avalanche.totalMonths;
  const avalancheBetter = interestDiff > 100;

  return (
    <div className="glass-card rounded-2xl p-6 border border-border space-y-5">
      <div className="flex items-center gap-2">
        <TrendingDown className="w-5 h-5 text-violet-400" />
        <h4 className="text-lg font-bold text-foreground m-0">Debt Payoff Strategy</h4>
        <span className="ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 uppercase tracking-wider">
          Snowball vs Avalanche
        </span>
      </div>
      <p className="text-xs text-muted-foreground -mt-2">
        Using ₹{extraPayment.toLocaleString("en-IN")} extra/month (from slider above). Freed minimums roll forward.
      </p>

      {/* Verdict */}
      <div className={`flex items-start gap-3 p-4 rounded-xl border ${avalancheBetter ? "border-emerald-500/30 bg-emerald-500/5" : "border-violet-500/30 bg-violet-500/5"}`}>
        <CheckCircle2 className={`w-5 h-5 shrink-0 mt-0.5 ${avalancheBetter ? "text-emerald-400" : "text-violet-400"}`} />
        <div>
          {avalancheBetter ? (
            <>
              <p className="text-sm font-bold text-emerald-400 m-0">Avalanche saves {fmt(interestDiff)} in interest</p>
              <p className="text-xs text-muted-foreground m-0 mt-0.5">
                Pay highest-rate loan first. Debt-free {monthDiff > 0 ? `${monthDiff} months earlier` : "at same time"} vs snowball.
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-bold text-violet-400 m-0">Both strategies perform similarly</p>
              <p className="text-xs text-muted-foreground m-0 mt-0.5">
                Interest difference is small. Snowball (smallest balance first) gives faster psychological wins.
              </p>
            </>
          )}
        </div>
      </div>

      {/* Side-by-side comparison */}
      <div className="grid grid-cols-2 gap-4">
        {(["snowball", "avalanche"] as const).map(strategy => {
          const result = strategy === "snowball" ? snowball : avalanche;
          const isWinner = strategy === "avalanche" && avalancheBetter;
          return (
            <div key={strategy} className={`relative rounded-xl border p-4 space-y-3 ${isWinner ? "border-emerald-500/30 bg-emerald-500/5" : "border-border/60 bg-white/[0.02]"}`}>
              {isWinner && (
                <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-emerald-500 text-white whitespace-nowrap">
                  Recommended
                </div>
              )}
              <p className="text-xs font-bold text-foreground capitalize m-0">{strategy}</p>
              <p className="text-[10px] text-muted-foreground m-0">
                {strategy === "snowball" ? "Smallest balance → biggest" : "Highest rate → lowest"}
              </p>
              <div className="space-y-2 pt-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Debt-free in</span>
                  <span className="font-bold text-foreground">{result.totalMonths} months</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Total interest</span>
                  <span className={`font-bold ${isWinner ? "text-emerald-400" : "text-amber-400"}`}>
                    {fmt(result.totalInterest)}
                  </span>
                </div>
              </div>
              <div className="pt-2 border-t border-border/40">
                <p className="text-[10px] text-muted-foreground mb-1.5 font-semibold uppercase tracking-wider">Payoff order</p>
                <div className="space-y-1">
                  {result.payoffOrder.map((p, i) => (
                    <div key={p.name} className="flex items-center gap-2 text-[11px]">
                      <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 ${isWinner ? "bg-emerald-500/20 text-emerald-400" : "bg-muted text-muted-foreground"}`}>
                        {i + 1}
                      </span>
                      <span className="truncate text-foreground">{p.name}</span>
                      <span className="ml-auto text-muted-foreground shrink-0">mo {p.month}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Zod schema for EMI validation
const emiSchema = z.object({
  name: z.string().min(1, "Loan name is required"),
  principal: z.coerce.number().positive("Principal must be greater than zero"),
  interest_rate: z.coerce.number().min(0, "Interest rate cannot be negative"),
  tenure_months: z.coerce.number().int().positive("Tenure must be a positive integer"),
  emi_amount: z.coerce.number().positive("EMI amount must be greater than zero"),
  start_date: z.string().min(1, "Start date is required"),
  paid_months: z.coerce.number().int().min(0).default(0),
});

type EmiFormValues = z.infer<typeof emiSchema>;

export const EmiManager: React.FC = () => {
  const { emis, profile, accounts, showToast, refreshData, fmt: formatIndianCurrency } = useApp();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingEmi, setEditingEmi] = useState<EMI | null>(null);

  // Pay-EMI account selector state (#5)
  const [payingEmiId, setPayingEmiId] = useState<string | null>(null);
  const [payFromAccount, setPayFromAccount] = useState<string>("");

  // Downpayment Calculator States
  const [assetPrice, setAssetPrice] = useState(500000);
  const [downpayment, setDownpayment] = useState(100000);
  const [interestRate, setInterestRate] = useState(8.5);
  const [tenureMonths, setTenureMonths] = useState(60);

  // Prepayment Calculator state (#6)
  const [extraPayment, setExtraPayment] = useState(1000);

  // Text-buffer state for the calculator number fields above (mirrors the numbers
  // but tolerates an empty string mid-edit — a bare `type="number"` bound directly
  // to a number snaps back to "0" on every keystroke and makes backspace unusable
  // on mobile). Slider drags update the number state directly, which syncs here.
  const [assetPriceStr, setAssetPriceStr]   = useState(String(assetPrice));
  const [downpaymentStr, setDownpaymentStr] = useState(String(downpayment));
  const [interestRateStr, setInterestRateStr] = useState(String(interestRate));
  const [tenureMonthsStr, setTenureMonthsStr] = useState(String(tenureMonths));
  const [extraPaymentStr, setExtraPaymentStr] = useState(String(extraPayment));

  useEffect(() => { setAssetPriceStr(String(assetPrice)); }, [assetPrice]);
  useEffect(() => { setDownpaymentStr(String(downpayment)); }, [downpayment]);
  useEffect(() => { setInterestRateStr(String(interestRate)); }, [interestRate]);
  useEffect(() => { setTenureMonthsStr(String(tenureMonths)); }, [tenureMonths]);
  useEffect(() => { setExtraPaymentStr(String(extraPayment)); }, [extraPayment]);

  const handleBufferedNumber = (
    raw: string,
    setStr: (v: string) => void,
    setNum: (v: number) => void,
    decimals: boolean
  ) => {
    const re = decimals ? /^[0-9]*\.?[0-9]*$/ : /^[0-9]*$/;
    if (!re.test(raw)) return;
    setStr(raw);
    if (raw !== "" && raw !== ".") setNum(Number(raw));
  };

  // Auto limit downpayment to asset price
  useEffect(() => {
    if (downpayment > assetPrice) {
      setDownpayment(assetPrice);
    }
  }, [assetPrice, downpayment]);

  // Downpayment Planner calculations
  const plannerPrincipal = Math.max(0, assetPrice - downpayment);
  const plannerR = interestRate / 100 / 12;

  let plannerEmi = 0;
  if (plannerPrincipal > 0) {
    if (plannerR > 0) {
      plannerEmi = (plannerPrincipal * plannerR * Math.pow(1 + plannerR, tenureMonths)) / (Math.pow(1 + plannerR, tenureMonths) - 1);
    } else {
      plannerEmi = plannerPrincipal / tenureMonths;
    }
  }
  plannerEmi = Math.round(plannerEmi);

  const plannerTotalPayment = plannerEmi * tenureMonths;
  const plannerTotalInterest = Math.max(0, plannerTotalPayment - plannerPrincipal);

  // Alternative Scenario (increase downpayment by ₹50,000)
  const altDownpayment = Math.min(assetPrice, downpayment + 50000);
  const altPrincipal = Math.max(0, assetPrice - altDownpayment);

  let altEmi = 0;
  if (altPrincipal > 0) {
    if (plannerR > 0) {
      altEmi = (altPrincipal * plannerR * Math.pow(1 + plannerR, tenureMonths)) / (Math.pow(1 + plannerR, tenureMonths) - 1);
    } else {
      altEmi = altPrincipal / tenureMonths;
    }
  }
  altEmi = Math.round(altEmi);
  const altTotalPayment = altEmi * tenureMonths;
  const altTotalInterest = Math.max(0, altTotalPayment - altPrincipal);

  const interestSavings = Math.max(0, plannerTotalInterest - altTotalInterest);
  const emiReduction = Math.max(0, plannerEmi - altEmi);

  const plannerPieData = [
    { name: "Principal Loan Amount", value: plannerPrincipal, color: "#8B5CF6" },
    { name: "Total Interest Cost", value: plannerTotalInterest, color: "#F59E0B" },
  ];

  // Math for existing loans
  const salary = profile ? Number(profile.monthly_salary) : 20000;
  const totalMonthlyEmi = emis.reduce((sum, e) => sum + Number(e.emi_amount), 0);
  const emiRatio = salary > 0 ? (totalMonthlyEmi / salary) * 100 : 0;

  // Traffic light conditions
  const getHealthStatus = (ratio: number) => {
    if (ratio < 15) return { color: "text-emerald-500 border-emerald-500/20 bg-emerald-500/5", icon: <CheckCircle2 className="w-5 h-5 text-emerald-500" />, status: "Safe 🟢", desc: "Your debt load is well within the healthy limit (<15%). Keep it up!" };
    if (ratio <= 20) return { color: "text-amber-500 border-amber-500/20 bg-amber-500/5", icon: <AlertTriangle className="w-5 h-5 text-amber-500" />, status: "Warning ⚠️", desc: `EMI is ${ratio.toFixed(1)}% of salary. Avoid taking new loans and try to reduce by ₹${formatIndianCurrency(totalMonthlyEmi - salary * 0.15)} to reach the safe zone.` };
    return { color: "text-rose-500 border-rose-500/20 bg-rose-500/5", icon: <XCircle className="w-5 h-5 text-rose-500" />, status: "Critical 🔴", desc: `EMI is ${ratio.toFixed(1)}% of salary. Debt exceeds 20% limit! Prioritize prepayments to prevent stress.` };
  };

  const health = getHealthStatus(emiRatio);

  // Amortization details calculator
  const getEmiDetails = (emi: any) => {
    const P = Number(emi.principal);
    const rate = Number(emi.interest_rate);
    const totalTenure = Number(emi.tenure_months);
    const PMT = Number(emi.emi_amount);
    const n = Number(emi.paid_months);

    const remainingMonths = Math.max(0, totalTenure - n);
    const r = rate / 100 / 12;

    let remainingPrincipal = P;
    if (r > 0) {
      remainingPrincipal = P * Math.pow(1 + r, n) - PMT * ((Math.pow(1 + r, n) - 1) / r);
    } else {
      remainingPrincipal = P - PMT * n;
    }
    remainingPrincipal = Math.max(0, Number(remainingPrincipal.toFixed(2)));

    const totalInterestCost = Math.max(0, (totalTenure * PMT) - P);
    const remainingInterest = Math.max(0, (remainingMonths * PMT) - remainingPrincipal);

    const startDate = new Date(emi.start_date);
    const payoffDate = addMonths(startDate, totalTenure);
    const currentPayoffDate = addMonths(startDate, totalTenure - n);

    return {
      remainingMonths,
      remainingPrincipal,
      totalInterestCost,
      remainingInterest,
      payoffDateStr: format(payoffDate, "MMM yyyy"),
      currentPayoffStr: format(currentPayoffDate, "dd MMM yyyy"),
    };
  };

  // #7 — Next due date helpers
  const getNextDueDate = (emi: any) => {
    const start = new Date(emi.start_date);
    return addMonths(start, Number(emi.paid_months) + 1);
  };

  const getDueBadgeStyle = (dueDate: Date) => {
    const daysUntil = differenceInDays(dueDate, new Date());
    if (daysUntil <= 5) return "bg-rose-500/15 border-rose-500/25 text-rose-500";
    if (daysUntil <= 10) return "bg-amber-500/15 border-amber-500/25 text-amber-500";
    return "bg-emerald-500/15 border-emerald-500/25 text-emerald-500";
  };

  // #6 — Prepayment savings calculator
  const getPrepaymentSavings = (emi: any, extra: number) => {
    const P = Number(emi.principal);
    const rate = Number(emi.interest_rate);
    const totalTenure = Number(emi.tenure_months);
    const PMT = Number(emi.emi_amount);
    const paidMonths = Number(emi.paid_months);
    const r = rate / 100 / 12;

    // Remaining principal after paid months
    let balance = P;
    if (r > 0) {
      balance = P * Math.pow(1 + r, paidMonths) - PMT * ((Math.pow(1 + r, paidMonths) - 1) / r);
    } else {
      balance = P - PMT * paidMonths;
    }
    balance = Math.max(0, balance);

    const remainingTenure = totalTenure - paidMonths;

    // Standard: total interest remaining without extra payment
    let standardInterest = 0;
    let bal = balance;
    for (let i = 0; i < remainingTenure && bal > 0; i++) {
      const intCharge = r > 0 ? bal * r : 0;
      standardInterest += intCharge;
      bal = bal - (PMT - intCharge);
      if (bal < 0) bal = 0;
    }

    // With extra payment
    let withExtraMonths = 0;
    let withExtraInterest = 0;
    bal = balance;
    const totalPMT = PMT + extra;
    while (bal > 0 && withExtraMonths < remainingTenure) {
      const intCharge = r > 0 ? bal * r : 0;
      withExtraInterest += intCharge;
      bal = bal - (totalPMT - intCharge);
      withExtraMonths++;
      if (bal < 0) bal = 0;
    }

    const monthsSaved = remainingTenure - withExtraMonths;
    const interestSaved = Math.max(0, standardInterest - withExtraInterest);

    // New payoff date
    const start = new Date(emi.start_date);
    const newPayoffDate = addMonths(start, paidMonths + withExtraMonths);

    return {
      monthsSaved,
      interestSaved,
      newPayoffStr: format(newPayoffDate, "MMM yyyy"),
    };
  };

  // #5 — Pay EMI from chosen account
  const handlePayEmi = async (emi: any, accountId: string) => {
    const account = accounts.find((a) => a.id === accountId);
    if (!account) {
      showToast("Selected account not found.", "warning");
      return;
    }

    if (Number(account.balance) < Number(emi.emi_amount)) {
      showToast(`Insufficient balance in ${account.name} to pay EMI`, "error");
      return;
    }

    const nextPaid = Number(emi.paid_months) + 1;
    if (nextPaid > Number(emi.tenure_months)) {
      showToast("This loan is already fully paid off!", "info");
      return;
    }

    try {
      await updateEmi({ id: emi.id, paid_months: nextPaid });

      await addTransaction({
        user_id: emi.user_id,
        account_id: account.id,
        type: "expense",
        amount: Number(emi.emi_amount),
        category: "EMI 💳",
        note: `EMI Payment: ${emi.name} (Month ${nextPaid}/${emi.tenure_months})`,
        date: new Date().toISOString().split("T")[0],
        is_recurring: false,
      });

      showToast(`Paid monthly EMI of ${formatIndianCurrency(emi.emi_amount)} from ${account.name}. Month ${nextPaid} marked paid.`, "success");
      setPayingEmiId(null);
      setPayFromAccount("");
      refreshData();
    } catch (err) {
      showToast("Failed to record EMI payment", "error");
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this EMI tracker?")) return;
    try {
      await deleteEmi(id);
      showToast("EMI tracker removed", "info");
      refreshData();
    } catch (err) {
      showToast("Failed to delete EMI", "error");
    }
  };

  const totalInterestRemaining = emis.reduce((sum, e) => sum + getEmiDetails(e).remainingInterest, 0);
  const totalInterestAcrossAll = emis.reduce((sum, e) => sum + getEmiDetails(e).totalInterestCost, 0);

  const activeEmis = emis.filter((e) => Number(e.paid_months) < Number(e.tenure_months));

  // Account options for CustomSelect
  const accountOptions = accounts.map((a) => ({
    value: a.id,
    label: a.name,
    description: `Balance: ${formatIndianCurrency(a.balance)}`,
  }));

  // Form for EMI creation / modification
  const EmiForm: React.FC<{ onClose: () => void; emi?: EMI }> = ({ onClose, emi }) => {
    const {
      register,
      handleSubmit,
      setValue,
      watch,
      formState: { errors },
    } = useForm<any>({
      resolver: zodResolver(emiSchema),
      defaultValues: {
        name: emi?.name || "",
        principal: emi?.principal || "",
        interest_rate: emi?.interest_rate || "",
        tenure_months: emi?.tenure_months || "",
        emi_amount: emi?.emi_amount || "",
        start_date: emi?.start_date ? emi.start_date.split("T")[0] : new Date().toISOString().split("T")[0],
        paid_months: emi?.paid_months || 0,
      },
    });

    const principal = watch("principal");
    const formInterestRate = watch("interest_rate");
    const formTenureMonths = watch("tenure_months");

    // Local string states for NumberInput
    const [principalStr, setPrincipalStr] = useState(String(emi?.principal || ""));
    const [rateStr, setRateStr] = useState(String(emi?.interest_rate || ""));
    const [tenureStr, setTenureStr] = useState(String(emi?.tenure_months || ""));
    const [emiAmountStr, setEmiAmountStr] = useState(String(emi?.emi_amount || ""));
    const [paidMonthsStr, setPaidMonthsStr] = useState(String(emi?.paid_months || 0));

    useEffect(() => {
      const p = Number(principalStr);
      const r = Number(rateStr);
      const n = Number(tenureStr);
      if (p > 0 && r >= 0 && n > 0) {
        const rMonthly = r / 100 / 12;
        let emiVal = 0;
        if (rMonthly > 0) {
          emiVal = (p * rMonthly * Math.pow(1 + rMonthly, n)) / (Math.pow(1 + rMonthly, n) - 1);
        } else {
          emiVal = p / n;
        }
        const rounded = String(Math.round(emiVal));
        setEmiAmountStr(rounded);
        setValue("emi_amount", Math.round(emiVal));
      }
    }, [principalStr, rateStr, tenureStr]);

    const onFormSubmit = async (data: any) => {
      if (!profile) return;
      try {
        if (emi) {
          await updateEmi({
            id: emi.id,
            name: data.name,
            principal: Number(principalStr),
            interest_rate: Number(rateStr),
            tenure_months: Number(tenureStr),
            emi_amount: Number(emiAmountStr),
            start_date: data.start_date,
            paid_months: Number(paidMonthsStr),
          });
          showToast("EMI details updated successfully", "success");
        } else {
          await addEmi({
            user_id: profile.id,
            name: data.name,
            principal: Number(principalStr),
            interest_rate: Number(rateStr),
            tenure_months: Number(tenureStr),
            emi_amount: Number(emiAmountStr),
            start_date: data.start_date,
            paid_months: Number(paidMonthsStr),
          });
          showToast("New EMI tracker created", "success");
        }

        refreshData();
        onClose();
      } catch (err: any) {
        showToast(err.message || "Failed to save EMI", "error");
      }
    };

    const getErrorMessage = (field: any) => field?.message?.toString() || "";

    return (
      <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Loan Name</label>
          <input
            type="text"
            placeholder="Bike Loan, Personal Loan, etc."
            {...register("name")}
            className="w-full bg-background border border-border rounded-xl min-h-[48px] py-3 px-3.5 text-foreground text-sm focus:outline-none focus:border-gold-500"
          />
          {errors.name && <p className="text-rose-400 text-xs mt-1">{getErrorMessage(errors.name)}</p>}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <NumberInput
            label="Principal (₹)"
            value={principalStr}
            onChange={(v) => { setPrincipalStr(v); setValue("principal", Number(v)); }}
            prefix="₹"
            placeholder="1,00,000"
            error={errors.principal ? getErrorMessage(errors.principal) : undefined}
          />
          <NumberInput
            label="Interest Rate (% p.a.)"
            value={rateStr}
            onChange={(v) => { setRateStr(v); setValue("interest_rate", Number(v)); }}
            decimals
            suffix="%"
            placeholder="9"
            error={errors.interest_rate ? getErrorMessage(errors.interest_rate) : undefined}
          />
          <NumberInput
            label="Tenure (Months)"
            value={tenureStr}
            onChange={(v) => { setTenureStr(v); setValue("tenure_months", Number(v)); }}
            suffix="mo"
            placeholder="36"
            error={errors.tenure_months ? getErrorMessage(errors.tenure_months) : undefined}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">Calculated EMI (₹)</label>
            <div className="w-full bg-muted border border-border rounded-xl min-h-[48px] py-3 px-3.5 text-muted-foreground text-sm font-bold flex items-center">
              {emiAmountStr ? `₹${Number(emiAmountStr).toLocaleString("en-IN")}` : "Auto-calculated"}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Start Date</label>
            <input
              type="date"
              {...register("start_date")}
              className="w-full bg-background border border-border rounded-xl min-h-[48px] py-3 px-3.5 text-foreground text-sm focus:outline-none focus:border-gold-500"
            />
            {errors.start_date && <p className="text-rose-400 text-xs mt-1">{getErrorMessage(errors.start_date)}</p>}
          </div>

          <NumberInput
            label="Months Paid Already"
            value={paidMonthsStr}
            onChange={(v) => { setPaidMonthsStr(v); setValue("paid_months", Number(v)); }}
            placeholder="0"
            error={errors.paid_months ? getErrorMessage(errors.paid_months) : undefined}
          />
        </div>

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
            className="flex-1 bg-gold-500 hover:bg-gold-600 text-white font-semibold py-2.5 rounded-xl transition-all shadow-lg hover:shadow-gold-500/30 text-sm"
          >
            Save Loan Tracker
          </button>
        </div>
      </form>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl md:text-3xl font-extrabold m-0 text-foreground">EMI Manager</h2>
          <p className="text-muted-foreground text-sm mt-1">Audit active loan commitments and interests</p>
        </div>
        <button
          onClick={() => setIsAddOpen(true)}
          className="btn-gold flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Add Loan EMI
        </button>
      </div>

      {/* EMI Health Card Box */}
      <div className={`p-5 rounded-2xl border ${health.color} flex flex-col md:flex-row gap-4 items-start`}>
        <div className="shrink-0 mt-0.5">{health.icon}</div>
        <div className="space-y-1.5 flex-1">
          <div className="flex items-center justify-between">
            <h4 className="text-base font-extrabold m-0 text-foreground flex items-center gap-2">
              EMI is {emiRatio.toFixed(1)}% of monthly salary
            </h4>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-white/10">
              {health.status}
            </span>
          </div>
          <p className="text-xs md:text-sm leading-relaxed m-0 text-foreground/90">
            {health.desc}
          </p>
          <div className="w-full h-3 bg-muted border border-border rounded-full mt-3 relative overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${emiRatio < 15 ? "bg-emerald-500" : emiRatio <= 20 ? "bg-amber-500" : "bg-rose-500"}`}
              style={{ width: `${Math.min(100, emiRatio)}%` }}
            />
            <div className="absolute top-0 bottom-0 left-[15%] w-0.5 bg-white/40" title="15% Limit" />
          </div>
        </div>
      </div>

      {/* Overview totals */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-card rounded-2xl p-5 border border-border">
          <span className="text-xs text-muted-foreground uppercase tracking-wider block">Monthly EMI Outflow</span>
          <span className="text-2xl font-bold text-foreground block mt-1">
            {formatIndianCurrency(totalMonthlyEmi)}
          </span>
          <span className="text-[10px] text-muted-foreground mt-2 block">Surplus impact on ₹{formatIndianCurrency(salary)} salary</span>
        </div>

        <div className="glass-card rounded-2xl p-5 border border-border">
          <span className="text-xs text-muted-foreground uppercase tracking-wider block">Remaining Interest Cost</span>
          <span className="text-2xl font-bold text-amber-500 block mt-1">
            {formatIndianCurrency(totalInterestRemaining)}
          </span>
          <span className="text-[10px] text-muted-foreground mt-2 block">Unpaid interest burden</span>
        </div>

        <div className="glass-card rounded-2xl p-5 border border-border">
          <span className="text-xs text-muted-foreground uppercase tracking-wider block">Total Interest cost of loans</span>
          <span className="text-2xl font-bold text-foreground/80 block mt-1">
            {formatIndianCurrency(totalInterestAcrossAll)}
          </span>
          <span className="text-[10px] text-muted-foreground mt-2 block">Total overhead on principal</span>
        </div>
      </div>

      {/* Active EMI list */}
      <div className="space-y-4">
        <h4 className="text-lg font-bold text-foreground mb-2">Active Loan Contracts</h4>

        {emis.length === 0 ? (
          <div className="glass-card rounded-2xl py-12 text-center text-muted-foreground text-sm border border-border">
            No active EMIs tracked. Congratulations, you are debt-free!
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {emis.map((emi) => {
              const details = getEmiDetails(emi);
              const progressPercent = (Number(emi.paid_months) / Number(emi.tenure_months)) * 100;
              const isPaidOff = Number(emi.paid_months) >= Number(emi.tenure_months);
              const nextDue = getNextDueDate(emi);
              const dueBadgeStyle = getDueBadgeStyle(nextDue);
              const isPayingThis = payingEmiId === emi.id;

              return (
                <div key={emi.id} className="glass-card rounded-2xl p-6 border border-border flex flex-col justify-between space-y-5 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-[0.02] pointer-events-none">
                    <CalendarDays className="w-24 h-24 text-foreground" />
                  </div>

                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0">
                      <h5 className="text-lg font-bold text-foreground m-0 flex items-center gap-2 flex-wrap">
                        {emi.name}
                        {isPaidOff && (
                          <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/20 text-emerald-500 font-bold uppercase tracking-wider">
                            Paid Off
                          </span>
                        )}
                      </h5>
                      <span className="text-xs text-muted-foreground mt-1 block">
                        Principal: {formatIndianCurrency(emi.principal)} @ {emi.interest_rate}% interest
                      </span>

                      {/* #7 — Next due date badge */}
                      {!isPaidOff && (
                        <div className={`inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-lg border text-[11px] font-semibold ${dueBadgeStyle}`}>
                          <CalendarDays className="w-3.5 h-3.5" />
                          Next Due: {format(nextDue, "d MMM yyyy")}
                        </div>
                      )}
                    </div>

                    <div className="flex gap-1 shrink-0 ml-2">
                      <button
                        onClick={() => setEditingEmi(emi)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-gold-400 hover:bg-gold-400/10 transition-all"
                        title="Edit Loan Tracker"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(emi.id)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-all"
                        title="Remove Loan Tracker"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 bg-muted/40 p-4 rounded-xl border border-border text-xs">
                    <div>
                      <span className="text-muted-foreground block">EMI Amount</span>
                      <span className="text-sm font-bold text-foreground block mt-0.5">
                        {formatIndianCurrency(emi.emi_amount)}/month
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Remaining Interest</span>
                      <span className="text-sm font-bold text-amber-500 block mt-0.5">
                        {isPaidOff ? "₹0.00" : formatIndianCurrency(details.remainingInterest)}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Payoff Target Date</span>
                      <span className="text-sm font-bold text-foreground block mt-0.5">
                        {details.payoffDateStr}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Remaining Balance</span>
                      <span className="text-sm font-bold text-foreground/80 block mt-0.5">
                        {isPaidOff ? "₹0.00" : formatIndianCurrency(details.remainingPrincipal)}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Tenure: {emi.paid_months} / {emi.tenure_months} months paid</span>
                      <span className="font-semibold text-foreground">{progressPercent.toFixed(0)}%</span>
                    </div>
                    <div className="w-full h-2.5 bg-muted border border-border rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gold-500 rounded-full transition-all duration-500"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </div>

                  {/* #5 — Pay EMI from any account */}
                  {!isPaidOff && !isPayingThis && (
                    <button
                      onClick={() => {
                        setPayingEmiId(emi.id);
                        setPayFromAccount(accounts[0]?.id || "");
                      }}
                      className="w-full bg-muted hover:bg-gold-500 border border-border hover:border-gold-500 hover:text-white text-foreground font-semibold py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 text-xs hover:shadow-lg hover:shadow-violet-600/20"
                    >
                      <Coins className="w-4 h-4" />
                      Record Monthly EMI Payment
                      <ChevronDown className="w-3.5 h-3.5 ml-0.5" />
                    </button>
                  )}

                  {/* Inline account selector panel */}
                  {!isPaidOff && isPayingThis && (
                    <div className="space-y-3 p-4 bg-muted/40 border border-border rounded-xl">
                      <p className="text-xs font-semibold text-foreground">
                        Select account to deduct {formatIndianCurrency(emi.emi_amount)} from:
                      </p>
                      <CustomSelect
                        options={accountOptions}
                        value={payFromAccount}
                        onChange={setPayFromAccount}
                        placeholder="Choose account"
                        label="Deduct from Account"
                        searchable={accountOptions.length > 5}
                      />
                      <div className="flex gap-2 mt-1">
                        <button
                          type="button"
                          onClick={() => { setPayingEmiId(null); setPayFromAccount(""); }}
                          className="flex-1 bg-muted hover:bg-muted/70 border border-border text-foreground font-semibold py-2 rounded-xl text-xs transition-all"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={!payFromAccount}
                          onClick={() => handlePayEmi(emi, payFromAccount)}
                          className="flex-1 bg-gold-500 hover:bg-gold-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2 rounded-xl text-xs transition-all flex items-center justify-center gap-1.5"
                        >
                          <Coins className="w-3.5 h-3.5" />
                          Confirm Payment
                        </button>
                      </div>
                    </div>
                  )}

                  {isPaidOff && (
                    <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center gap-2 text-xs text-emerald-500 font-semibold">
                      <Sparkles className="w-4 h-4 animate-bounce" /> Fully Paid off! You saved interest fees.
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* EMI Downpayment Planner Calculator */}
      <div className="glass-card rounded-2xl p-6 border border-border space-y-6">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-gold-400" />
          <h4 className="text-lg font-bold text-foreground m-0">EMI Downpayment Planner</h4>
        </div>
        <p className="text-xs text-muted-foreground -mt-3">
          Plan downpayments on major purchases (Bike, Phone, Laptop) to optimize interest savings and EMIs.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="space-y-5 lg:col-span-1.5">
            <div className="space-y-1">
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground font-semibold uppercase">Purchase Price</span>
                <div className="flex items-center gap-1 bg-background border border-border rounded-lg px-2 py-0.5 text-foreground font-bold text-xs">
                  <span className="text-muted-foreground text-[10px]">₹</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    value={assetPriceStr}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => handleBufferedNumber(e.target.value, setAssetPriceStr, setAssetPrice, false)}
                    onBlur={() => { if (assetPriceStr === "") setAssetPrice(20000); }}
                    className="w-20 bg-transparent text-foreground text-right focus:outline-none"
                  />
                </div>
              </div>
              <input
                type="range"
                min={20000}
                max={1500000}
                step={5000}
                value={assetPrice}
                onChange={(e) => setAssetPrice(Number(e.target.value))}
                className="w-full accent-gold-500 bg-muted rounded-lg appearance-none h-1.5 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>₹20k</span>
                <span>₹7.5L</span>
                <span>₹15L</span>
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground font-semibold uppercase">Downpayment Amount</span>
                <div className="flex items-center gap-1 bg-background border border-border rounded-lg px-2 py-0.5 text-foreground font-bold text-xs">
                  <span className="text-muted-foreground text-[10px]">₹</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    value={downpaymentStr}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => handleBufferedNumber(e.target.value, setDownpaymentStr, setDownpayment, false)}
                    onBlur={() => { if (downpaymentStr === "") setDownpayment(0); }}
                    className="w-20 bg-transparent text-foreground text-right focus:outline-none"
                  />
                </div>
              </div>
              <input
                type="range"
                min={0}
                max={assetPrice}
                step={2000}
                value={downpayment}
                onChange={(e) => setDownpayment(Number(e.target.value))}
                className="w-full accent-gold-500 bg-muted rounded-lg appearance-none h-1.5 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>₹0 (0%)</span>
                <span>{formatIndianCurrency(Math.round(assetPrice / 2))} (50%)</span>
                <span>{formatIndianCurrency(assetPrice)} (100%)</span>
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground font-semibold uppercase">Interest Rate</span>
                <div className="flex items-center gap-1 bg-background border border-border rounded-lg px-2 py-0.5 text-foreground font-bold text-xs">
                  <input
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    value={interestRateStr}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => handleBufferedNumber(e.target.value, setInterestRateStr, setInterestRate, true)}
                    onBlur={() => { if (interestRateStr === "" || interestRateStr === ".") setInterestRate(0); }}
                    className="w-12 bg-transparent text-foreground text-right focus:outline-none"
                  />
                  <span className="text-muted-foreground text-[10px]">%</span>
                </div>
              </div>
              <input
                type="range"
                min={0}
                max={20}
                step={0.5}
                value={interestRate}
                onChange={(e) => setInterestRate(Number(e.target.value))}
                className="w-full accent-gold-500 bg-muted rounded-lg appearance-none h-1.5 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>0%</span>
                <span>10%</span>
                <span>20%</span>
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground font-semibold uppercase">Loan Tenure</span>
                <div className="flex items-center gap-1 bg-background border border-border rounded-lg px-2 py-0.5 text-foreground font-bold text-xs">
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    value={tenureMonthsStr}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => handleBufferedNumber(e.target.value, setTenureMonthsStr, setTenureMonths, false)}
                    onBlur={() => { if (tenureMonthsStr === "" || Number(tenureMonthsStr) < 1) setTenureMonths(1); }}
                    className="w-10 bg-transparent text-foreground text-right focus:outline-none"
                  />
                  <span className="text-muted-foreground text-[10px]">Months</span>
                </div>
              </div>
              <input
                type="range"
                min={6}
                max={84}
                step={6}
                value={tenureMonths}
                onChange={(e) => setTenureMonths(Number(e.target.value))}
                className="w-full accent-gold-500 bg-muted rounded-lg appearance-none h-1.5 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>6m</span>
                <span>36m</span>
                <span>84m</span>
              </div>
            </div>
          </div>

          <div className="space-y-4 lg:col-span-1.5 flex flex-col justify-between">
            <div className="grid grid-cols-3 gap-3 bg-muted/40 p-4 rounded-2xl border border-border text-center">
              <div>
                <span className="text-[10px] text-muted-foreground uppercase block font-semibold">Monthly EMI</span>
                <span className="text-base font-extrabold text-gold-400 block mt-1">
                  {formatIndianCurrency(plannerEmi)}
                </span>
              </div>
              <div className="border-x border-border">
                <span className="text-[10px] text-muted-foreground uppercase block font-semibold">Principal</span>
                <span className="text-base font-extrabold text-foreground block mt-1">
                  {formatIndianCurrency(plannerPrincipal)}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground uppercase block font-semibold">Interest</span>
                <span className="text-base font-extrabold text-amber-500 block mt-1">
                  {formatIndianCurrency(plannerTotalInterest)}
                </span>
              </div>
            </div>

            {plannerPrincipal > 0 && (
              <div className="p-4 rounded-xl bg-gold-500/10 border border-gold-500/20 text-xs flex gap-3 items-start">
                <TrendingDown className="w-5 h-5 text-gold-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-bold text-foreground block">Smart Downpayment Tip</span>
                  <p className="text-muted-foreground leading-relaxed m-0">
                    If you add just <span className="font-semibold text-foreground">₹50,000</span> more to your downpayment, your monthly EMI drops by <span className="font-bold text-emerald-500">₹{formatIndianCurrency(emiReduction)}</span>, and you save <span className="font-bold text-emerald-500">₹{formatIndianCurrency(interestSavings)}</span> in total interest costs!
                  </p>
                </div>
              </div>
            )}

            {plannerPrincipal === 0 && (
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs flex gap-3 items-start">
                <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-bold text-foreground block">100% Downpayment (Cash Purchase)</span>
                  <p className="text-muted-foreground leading-relaxed m-0">
                    Buying in full cash saves you <span className="font-bold text-emerald-500">₹{formatIndianCurrency(plannerTotalInterest)}</span> in interest fees and incurs no monthly EMIs. Recommended for smaller assets!
                  </p>
                </div>
              </div>
            )}

            <div className="h-32 w-full flex items-center justify-center relative">
              {plannerPrincipal > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={plannerPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={30}
                      outerRadius={45}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {plannerPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const item = payload[0];
                        const total = plannerPieData.reduce((s: number, d: any) => s + d.value, 0);
                        const pct = total > 0 ? ((Number(item.value) / total) * 100).toFixed(1) : "0";
                        return (
                          <div className="bg-card/95 backdrop-blur border border-border rounded-xl px-3 py-2 shadow-xl">
                            <p className="text-xs font-semibold text-foreground m-0">{item.name}</p>
                            <p className="text-sm font-bold text-foreground m-0 mt-0.5">
                              {formatIndianCurrency(Number(item.value))}
                              <span className="text-xs font-semibold text-muted-foreground ml-1.5">{pct}%</span>
                            </p>
                          </div>
                        );
                      }}
                    />
                    <Legend
                      layout="vertical"
                      verticalAlign="middle"
                      align="right"
                      iconSize={8}
                      wrapperStyle={{ fontSize: "10px", right: 20 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5" /> No active loan structure for 100% downpayment.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* #6 — Prepayment Savings Calculator */}
      {activeEmis.length > 0 && (
        <div className="glass-card rounded-2xl p-6 border border-border space-y-5">
          <div className="flex items-center gap-2">
            <TrendingDown className="w-5 h-5 text-emerald-400" />
            <h4 className="text-lg font-bold text-foreground m-0">Prepayment Savings Calculator</h4>
          </div>
          <p className="text-xs text-muted-foreground -mt-2">
            See how much faster you can pay off your loans — and how much interest you save — by paying a little extra each month.
          </p>

          {/* Extra payment slider */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="text-muted-foreground font-semibold uppercase">Extra Monthly Payment</span>
              <div className="flex items-center gap-1 bg-background border border-border rounded-lg px-2 py-0.5 text-foreground font-bold text-xs">
                <span className="text-muted-foreground text-[10px]">₹</span>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  value={extraPaymentStr}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => handleBufferedNumber(e.target.value, setExtraPaymentStr, setExtraPayment, false)}
                  onBlur={() => { if (extraPaymentStr === "") setExtraPayment(0); }}
                  className="w-20 bg-transparent text-foreground text-right focus:outline-none"
                />
              </div>
            </div>
            <input
              type="range"
              min={500}
              max={50000}
              step={500}
              value={extraPayment}
              onChange={(e) => setExtraPayment(Number(e.target.value))}
              className="w-full accent-emerald-500 bg-muted rounded-lg appearance-none h-1.5 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>₹500</span>
              <span>₹25,000</span>
              <span>₹50,000</span>
            </div>
          </div>

          {/* Per-EMI breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeEmis.map((emi) => {
              const savings = getPrepaymentSavings(emi, extraPayment);
              return (
                <div key={emi.id} className="bg-muted/40 border border-border rounded-xl p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-sm font-bold text-foreground block">{emi.name}</span>
                      <span className="text-[11px] text-muted-foreground">
                        {formatIndianCurrency(emi.emi_amount)}/mo + {formatIndianCurrency(extraPayment)} extra
                      </span>
                    </div>
                    <span className="shrink-0 text-[10px] font-semibold px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-500">
                      {savings.monthsSaved > 0 ? `${savings.monthsSaved}mo saved` : "No change"}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-muted-foreground block">New Payoff Date</span>
                      <span className="font-bold text-foreground block mt-0.5">{savings.newPayoffStr}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Interest Saved</span>
                      <span className="font-bold text-emerald-500 block mt-0.5">
                        {savings.interestSaved > 0 ? `+${formatIndianCurrency(savings.interestSaved)}` : "₹0"}
                      </span>
                    </div>
                  </div>

                  {savings.monthsSaved > 0 && (
                    <div className="text-[11px] text-muted-foreground bg-emerald-500/5 border border-emerald-500/10 rounded-lg px-3 py-2">
                      Pay off <span className="font-semibold text-emerald-400">{savings.monthsSaved} months earlier</span> and save <span className="font-semibold text-emerald-400">{formatIndianCurrency(savings.interestSaved)}</span> in interest by adding just {formatIndianCurrency(extraPayment)}/month.
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Snowball vs Avalanche Planner ─────────────────────────────────── */}
      {activeEmis.length >= 2 && (
        <SnowballAvalanchePlanner emis={activeEmis} extraPayment={extraPayment} fmt={formatIndianCurrency} />
      )}

      {/* Add Modal */}
      <Modal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title="Add Loan Tracker">
        <EmiForm onClose={() => setIsAddOpen(false)} />
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={editingEmi !== null} onClose={() => setEditingEmi(null)} title="Edit Loan Tracker">
        {editingEmi && (
          <EmiForm
            emi={editingEmi}
            onClose={() => setEditingEmi(null)}
          />
        )}
      </Modal>
    </div>
  );
};
