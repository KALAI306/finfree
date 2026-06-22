import React, { useState, useEffect } from "react";
import { useApp } from "../context/AppContext";
import { formatIndianCurrency } from "../lib/utils";
import { addEmi, updateEmi, deleteEmi, addTransaction } from "../lib/db";
import { addMonths, format } from "date-fns";
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
  Info
} from "lucide-react";
import { Modal } from "../components/Modal";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import type { EMI } from "../lib/db";

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
  const { emis, profile, accounts, showToast, refreshData } = useApp();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingEmi, setEditingEmi] = useState<EMI | null>(null);

  // Downpayment Calculator States
  const [assetPrice, setAssetPrice] = useState(500000);
  const [downpayment, setDownpayment] = useState(100000);
  const [interestRate, setInterestRate] = useState(8.5);
  const [tenureMonths, setTenureMonths] = useState(60);

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
    { name: "Total Interest Cost", value: plannerTotalInterest, color: "#F59E0B" }
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

  const handlePayEmi = async (emi: any) => {
    const sbiAccount = accounts.find(a => a.name.toLowerCase() === "sbi");
    if (!sbiAccount) {
      showToast("Cannot auto-deduct. No SBI savings account found.", "warning");
      return;
    }

    if (sbiAccount.balance < emi.emi_amount) {
      showToast("Insufficient balance in SBI account to pay EMI", "error");
      return;
    }

    const nextPaid = emi.paid_months + 1;
    if (nextPaid > emi.tenure_months) {
      showToast("This loan is already fully paid off!", "info");
      return;
    }

    try {
      await updateEmi({ id: emi.id, paid_months: nextPaid });

      await addTransaction({
        user_id: emi.user_id,
        account_id: sbiAccount.id,
        type: "expense",
        amount: Number(emi.emi_amount),
        category: "EMI 💳",
        note: `EMI Payment: ${emi.name} (Month ${nextPaid}/${emi.tenure_months})`,
        date: new Date().toISOString().split("T")[0],
        is_recurring: false
      });

      showToast(`Paid monthly EMI of ${formatIndianCurrency(emi.emi_amount)}. Month ${nextPaid} marked paid.`, "success");
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

  // Form for EMI creation / modification
  const EmiForm: React.FC<{ onClose: () => void; emi?: EMI }> = ({ onClose, emi }) => {
    const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<any>({
      resolver: zodResolver(emiSchema),
      defaultValues: {
        name: emi?.name || "",
        principal: emi?.principal || "",
        interest_rate: emi?.interest_rate || "",
        tenure_months: emi?.tenure_months || "",
        emi_amount: emi?.emi_amount || "",
        start_date: emi?.start_date ? emi.start_date.split("T")[0] : new Date().toISOString().split("T")[0],
        paid_months: emi?.paid_months || 0,
      }
    });

    const principal = watch("principal");
    const interestRate = watch("interest_rate");
    const tenureMonths = watch("tenure_months");

    useEffect(() => {
      if (principal > 0 && interestRate >= 0 && tenureMonths > 0) {
        const p = Number(principal);
        const r = Number(interestRate) / 100 / 12;
        const n = Number(tenureMonths);

        let emiVal = 0;
        if (r > 0) {
          emiVal = (p * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
        } else {
          emiVal = p / n;
        }

        setValue("emi_amount", Math.round(emiVal));
      }
    }, [principal, interestRate, tenureMonths]);

    const onFormSubmit = async (data: any) => {
      if (!profile) return;
      try {
        if (emi) {
          await updateEmi({
            id: emi.id,
            name: data.name,
            principal: Number(data.principal),
            interest_rate: Number(data.interest_rate),
            tenure_months: Number(data.tenure_months),
            emi_amount: Number(data.emi_amount),
            start_date: data.start_date,
            paid_months: Number(data.paid_months),
          });
          showToast("EMI details updated successfully", "success");
        } else {
          await addEmi({
            user_id: profile.id,
            name: data.name,
            principal: Number(data.principal),
            interest_rate: Number(data.interest_rate),
            tenure_months: Number(data.tenure_months),
            emi_amount: Number(data.emi_amount),
            start_date: data.start_date,
            paid_months: Number(data.paid_months),
          });
          showToast("New EMI tracker created", "success");
        }

        refreshData();
        onClose();
      } catch (err: any) {
        showToast(err.message || "Failed to save EMI", "error");
      }
    };

    const getErrorMessage = (field: any) => {
      return field?.message?.toString() || "";
    };

    return (
      <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Loan Name</label>
          <input
            type="text"
            placeholder="Bike Loan, Personal Loan, etc."
            {...register("name")}
            className="w-full bg-background border border-border rounded-xl py-2.5 px-3 text-foreground text-sm focus:outline-none focus:border-gold-500"
          />
          {errors.name && <p className="text-rose-400 text-xs mt-1">{getErrorMessage(errors.name)}</p>}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Principal (₹)</label>
            <input
              type="number"
              placeholder="1,00,000"
              {...register("principal")}
              className="w-full bg-background border border-border rounded-xl py-2.5 px-3 text-foreground text-sm focus:outline-none focus:border-gold-500"
            />
            {errors.principal && <p className="text-rose-400 text-xs mt-1">{getErrorMessage(errors.principal)}</p>}
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Interest Rate (% p.a.)</label>
            <input
              type="number"
              step="any"
              placeholder="9"
              {...register("interest_rate")}
              className="w-full bg-background border border-border rounded-xl py-2.5 px-3 text-foreground text-sm focus:outline-none focus:border-gold-500"
            />
            {errors.interest_rate && <p className="text-rose-400 text-xs mt-1">{getErrorMessage(errors.interest_rate)}</p>}
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Tenure (Months)</label>
            <input
              type="number"
              placeholder="36"
              {...register("tenure_months")}
              className="w-full bg-background border border-border rounded-xl py-2.5 px-3 text-foreground text-sm focus:outline-none focus:border-gold-500"
            />
            {errors.tenure_months && <p className="text-rose-400 text-xs mt-1">{getErrorMessage(errors.tenure_months)}</p>}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Calculated EMI (₹)</label>
            <input
              type="number"
              readOnly
              placeholder="Auto-calculated"
              {...register("emi_amount")}
              className="w-full bg-muted border border-border rounded-xl py-2.5 px-3 text-muted-foreground text-sm font-bold focus:outline-none"
            />
            {errors.emi_amount && <p className="text-rose-400 text-xs mt-1">{getErrorMessage(errors.emi_amount)}</p>}
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Start Date</label>
            <input
              type="date"
              {...register("start_date")}
              className="w-full bg-background border border-border rounded-xl py-2.5 px-3 text-foreground text-sm focus:outline-none focus:border-gold-500"
            />
            {errors.start_date && <p className="text-rose-400 text-xs mt-1">{getErrorMessage(errors.start_date)}</p>}
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Months Paid Already</label>
            <input
              type="number"
              placeholder="0"
              {...register("paid_months")}
              className="w-full bg-background border border-border rounded-xl py-2.5 px-3 text-foreground text-sm focus:outline-none focus:border-gold-500"
            />
            {errors.paid_months && <p className="text-rose-400 text-xs mt-1">{getErrorMessage(errors.paid_months)}</p>}
          </div>
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
              
              return (
                <div key={emi.id} className="glass-card rounded-2xl p-6 border border-border flex flex-col justify-between space-y-5 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-[0.02] pointer-events-none">
                    <CalendarDays className="w-24 h-24 text-foreground" />
                  </div>

                  <div className="flex justify-between items-start">
                    <div>
                      <h5 className="text-lg font-bold text-foreground m-0 flex items-center gap-2">
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
                    </div>
                    
                    <div className="flex gap-1 shrink-0">
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

                  {!isPaidOff && (
                    <button
                      onClick={() => handlePayEmi(emi)}
                      className="w-full bg-muted hover:bg-gold-500 border border-border hover:border-gold-500 hover:text-white text-foreground font-semibold py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 text-xs hover:shadow-lg hover:shadow-violet-600/20"
                    >
                      <Coins className="w-4 h-4" />
                      Record Monthly EMI payment (Deduct SBI)
                    </button>
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
                    type="number"
                    min={20000}
                    max={15000000}
                    value={assetPrice}
                    onChange={(e) => setAssetPrice(Number(e.target.value))}
                    className="w-20 bg-transparent text-foreground text-right focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
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
                    type="number"
                    min={0}
                    max={assetPrice}
                    value={downpayment}
                    onChange={(e) => setDownpayment(Number(e.target.value))}
                    className="w-20 bg-transparent text-foreground text-right focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
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
                    type="number"
                    step="0.1"
                    min={0}
                    max={100}
                    value={interestRate}
                    onChange={(e) => setInterestRate(Number(e.target.value))}
                    className="w-12 bg-transparent text-foreground text-right focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
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
                    type="number"
                    min={1}
                    max={360}
                    value={tenureMonths}
                    onChange={(e) => setTenureMonths(Number(e.target.value))}
                    className="w-10 bg-transparent text-foreground text-right focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
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
                      contentStyle={{ backgroundColor: "var(--card)", borderColor: "var(--border)", borderRadius: "10px", color: "var(--foreground)" }}
                      formatter={(value: any) => [formatIndianCurrency(value), ""]}
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
