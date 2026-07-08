import React, { useState, useMemo } from "react";
import { useApp } from "../context/AppContext";
import { Receipt, TrendingDown, CheckCircle, Info } from "lucide-react";

// ── FY 2025-26 Tax Calculation ───────────────────────────────────────────────

function calcOldRegime(grossIncome: number, deductions: {
  section80C: number;
  section80D: number;
  hra: number;
  homeLoanInterest: number;
}) {
  const stdDeduction = 50_000;
  const total80C = Math.min(deductions.section80C, 150_000);
  const total80D = Math.min(deductions.section80D, 25_000);
  const hra = Math.min(deductions.hra, grossIncome * 0.5);
  const homeLoan = Math.min(deductions.homeLoanInterest, 200_000);

  const totalDeductions = stdDeduction + total80C + total80D + hra + homeLoan;
  const taxableIncome = Math.max(0, grossIncome - totalDeductions);

  let tax = 0;
  if (taxableIncome > 1_000_000) tax += (taxableIncome - 1_000_000) * 0.30;
  if (taxableIncome > 500_000) tax += (Math.min(taxableIncome, 1_000_000) - 500_000) * 0.20;
  if (taxableIncome > 250_000) tax += (Math.min(taxableIncome, 500_000) - 250_000) * 0.05;

  // Sec 87A rebate: up to ₹12,500 if taxable income ≤ ₹5L
  const rebate = taxableIncome <= 500_000 ? Math.min(tax, 12_500) : 0;
  tax = Math.max(0, tax - rebate);

  const cess = tax * 0.04;
  return {
    grossIncome,
    taxableIncome,
    deductions: totalDeductions,
    tax,
    cess,
    totalTax: tax + cess,
    effectiveRate: grossIncome > 0 ? ((tax + cess) / grossIncome) * 100 : 0,
  };
}

function calcNewRegime(grossIncome: number) {
  const stdDeduction = 75_000;
  const taxableIncome = Math.max(0, grossIncome - stdDeduction);

  let tax = 0;
  if (taxableIncome > 2_400_000) tax += (taxableIncome - 2_400_000) * 0.30;
  if (taxableIncome > 2_000_000) tax += (Math.min(taxableIncome, 2_400_000) - 2_000_000) * 0.25;
  if (taxableIncome > 1_600_000) tax += (Math.min(taxableIncome, 2_000_000) - 1_600_000) * 0.20;
  if (taxableIncome > 1_200_000) tax += (Math.min(taxableIncome, 1_600_000) - 1_200_000) * 0.15;
  if (taxableIncome > 800_000)   tax += (Math.min(taxableIncome, 1_200_000) - 800_000) * 0.10;
  if (taxableIncome > 400_000)   tax += (Math.min(taxableIncome, 800_000) - 400_000) * 0.05;

  // Sec 87A rebate: up to ₹60,000 if taxable income ≤ ₹12L
  const rebate = taxableIncome <= 1_200_000 ? Math.min(tax, 60_000) : 0;
  tax = Math.max(0, tax - rebate);

  const cess = tax * 0.04;
  return {
    grossIncome,
    taxableIncome,
    deductions: stdDeduction,
    tax,
    cess,
    totalTax: tax + cess,
    effectiveRate: grossIncome > 0 ? ((tax + cess) / grossIncome) * 100 : 0,
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  "₹" + Math.round(n).toLocaleString("en-IN");

const pct = (n: number) => n.toFixed(1) + "%";

// ── Component ─────────────────────────────────────────────────────────────────

export const TaxEstimator: React.FC = () => {
  const { profile, investments } = useApp();

  // Prefill annual salary from profile
  const defaultSalary = (profile?.monthly_salary || 0) * 12;

  // Prefill 80C from investments tagged ppf/nps/fd/elss
  const default80C = useMemo(() => {
    if (!investments?.length) return 0;
    const eligible80C = ["ppf", "nps", "fd", "elss"];
    return investments
      .filter(inv => eligible80C.some(t => inv.type?.toLowerCase().includes(t)))
      .reduce((s, inv) => s + Number(inv.invested_amount || 0), 0);
  }, [investments]);

  const [salary, setSalary] = useState(defaultSalary);
  const [otherIncome, setOtherIncome] = useState(0);
  const [section80C, setSection80C] = useState(default80C);
  const [section80D, setSection80D] = useState(0);
  const [hra, setHra] = useState(0);
  const [homeLoanInterest, setHomeLoanInterest] = useState(0);

  const grossIncome = salary + otherIncome;

  const oldResult = useMemo(
    () => calcOldRegime(grossIncome, { section80C, section80D, hra, homeLoanInterest }),
    [grossIncome, section80C, section80D, hra, homeLoanInterest],
  );

  const newResult = useMemo(() => calcNewRegime(grossIncome), [grossIncome]);

  const savings = oldResult.totalTax - newResult.totalTax;
  const newRegimeBetter = savings > 0;

  const InputField = ({
    label, value, onChange, max, hint,
  }: {
    label: string;
    value: number;
    onChange: (v: number) => void;
    max?: number;
    hint?: string;
  }) => (
    <div>
      <label className="block text-xs font-semibold text-muted-foreground mb-1.5">{label}</label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-primary">₹</span>
        <input
          type="number"
          value={value || ""}
          onChange={e => onChange(Number(e.target.value) || 0)}
          placeholder="0"
          min={0}
          max={max}
          className="w-full pl-8 pr-3 py-2.5 rounded-xl bg-white/[0.04] border border-border/60 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50 focus:bg-white/[0.06] transition-colors"
        />
      </div>
      {hint && <p className="text-[10px] text-muted-foreground/60 mt-1">{hint}</p>}
    </div>
  );

  const RegimeCard = ({
    title, result, winner, color,
  }: {
    title: string;
    result: ReturnType<typeof calcOldRegime>;
    winner: boolean;
    color: string;
  }) => (
    <div className={`relative rounded-2xl border p-5 transition-all ${winner ? `border-${color}-500/40 bg-${color}-500/5` : "border-border/50 bg-white/[0.02]"}`}>
      {winner && (
        <div className={`absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-${color}-500 text-white`}>
          Recommended
        </div>
      )}
      <h3 className="text-sm font-bold text-foreground mb-4">{title}</h3>

      <div className="space-y-2.5">
        <Row label="Gross Income" value={fmt(result.grossIncome)} />
        <Row label="Total Deductions" value={fmt(result.deductions)} muted />
        <Row label="Taxable Income" value={fmt(result.taxableIncome)} />
        <div className="border-t border-border/40 pt-2.5 mt-2.5">
          <Row label="Income Tax" value={fmt(result.tax)} />
          <Row label="Health & Edu Cess (4%)" value={fmt(result.cess)} muted />
        </div>
        <div className="border-t border-border/40 pt-2.5 mt-2.5">
          <div className="flex justify-between items-center">
            <span className="text-sm font-bold text-foreground">Total Tax</span>
            <span className={`text-lg font-bold ${winner ? `text-${color}-400` : "text-foreground"}`}>
              {fmt(result.totalTax)}
            </span>
          </div>
          <div className="flex justify-between items-center mt-1">
            <span className="text-xs text-muted-foreground">Effective Rate</span>
            <span className="text-xs font-semibold text-muted-foreground">{pct(result.effectiveRate)}</span>
          </div>
        </div>
      </div>
    </div>
  );

  const Row = ({ label, value, muted }: { label: string; value: string; muted?: boolean }) => (
    <div className="flex justify-between items-center">
      <span className={`text-xs ${muted ? "text-muted-foreground/60" : "text-muted-foreground"}`}>{label}</span>
      <span className={`text-xs font-semibold ${muted ? "text-muted-foreground/60" : "text-foreground"}`}>{value}</span>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Receipt className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground m-0">Tax Estimator</h1>
          <p className="text-xs text-muted-foreground m-0">FY 2025-26 · Old vs New Regime</p>
        </div>
      </div>

      {/* Verdict banner */}
      {grossIncome > 0 && (
        <div className={`flex items-center gap-3 p-4 rounded-2xl border ${
          Math.abs(savings) < 1000
            ? "border-border/50 bg-white/[0.02]"
            : newRegimeBetter
              ? "border-emerald-500/30 bg-emerald-500/5"
              : "border-amber-500/30 bg-amber-500/5"
        }`}>
          {Math.abs(savings) < 1000 ? (
            <Info className="w-5 h-5 text-muted-foreground shrink-0" />
          ) : (
            <CheckCircle className={`w-5 h-5 shrink-0 ${newRegimeBetter ? "text-emerald-400" : "text-amber-400"}`} />
          )}
          <div>
            {Math.abs(savings) < 1000 ? (
              <p className="text-sm font-semibold text-foreground m-0">Both regimes are roughly equal for your income.</p>
            ) : newRegimeBetter ? (
              <>
                <p className="text-sm font-bold text-emerald-400 m-0">New Regime saves you {fmt(savings)}/year</p>
                <p className="text-xs text-muted-foreground m-0">Switch to the new regime for lower taxes this FY.</p>
              </>
            ) : (
              <>
                <p className="text-sm font-bold text-amber-400 m-0">Old Regime saves you {fmt(-savings)}/year</p>
                <p className="text-xs text-muted-foreground m-0">Your deductions make the old regime more beneficial.</p>
              </>
            )}
          </div>
          {grossIncome > 0 && Math.abs(savings) >= 1000 && (
            <div className="ml-auto text-right">
              <p className="text-[10px] text-muted-foreground m-0">Monthly saving</p>
              <p className={`text-sm font-bold m-0 ${newRegimeBetter ? "text-emerald-400" : "text-amber-400"}`}>
                {fmt(Math.abs(savings) / 12)}
              </p>
            </div>
          )}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {/* Inputs */}
        <div className="space-y-5">
          <div className="p-5 rounded-2xl border border-border/50 bg-white/[0.02] space-y-4">
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2 m-0">
              <TrendingDown className="w-4 h-4 text-primary" /> Income
            </h2>
            <InputField
              label="Annual Salary / CTC"
              value={salary}
              onChange={setSalary}
              hint="Prefilled from your profile"
            />
            <InputField
              label="Other Income (interest, rent, etc.)"
              value={otherIncome}
              onChange={setOtherIncome}
            />
          </div>

          <div className="p-5 rounded-2xl border border-border/50 bg-white/[0.02] space-y-4">
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2 m-0">
              <Receipt className="w-4 h-4 text-primary" /> Deductions (Old Regime only)
            </h2>
            <InputField
              label="Section 80C (PPF, ELSS, NPS, FD…)"
              value={section80C}
              onChange={setSection80C}
              max={150_000}
              hint={`Max ₹1,50,000 · Prefilled from eligible investments`}
            />
            <InputField
              label="Section 80D (Health Insurance)"
              value={section80D}
              onChange={setSection80D}
              max={25_000}
              hint="Max ₹25,000 (₹50,000 for senior citizens)"
            />
            <InputField
              label="HRA Exemption"
              value={hra}
              onChange={setHra}
              hint="Actual HRA received (limited to 50% of salary)"
            />
            <InputField
              label="Home Loan Interest (Sec 24b)"
              value={homeLoanInterest}
              onChange={setHomeLoanInterest}
              max={200_000}
              hint="Max ₹2,00,000 for self-occupied property"
            />
          </div>

          {/* Regime notes */}
          <div className="p-4 rounded-xl border border-border/40 bg-white/[0.01] text-xs text-muted-foreground space-y-1.5">
            <p className="font-semibold text-foreground/70 m-0">FY 2025-26 defaults included</p>
            <p className="m-0">• Standard deduction: ₹75,000 (new) / ₹50,000 (old)</p>
            <p className="m-0">• Sec 87A rebate: nil tax up to ₹12L income (new regime)</p>
            <p className="m-0">• 4% health & education cess on all tax</p>
            <p className="m-0">• Surcharge not included (applies above ₹50L)</p>
          </div>
        </div>

        {/* Results */}
        <div className="space-y-4">
          <RegimeCard
            title="New Regime (Default)"
            result={newResult}
            winner={newRegimeBetter || Math.abs(savings) < 1000}
            color="emerald"
          />
          <RegimeCard
            title="Old Regime"
            result={oldResult}
            winner={!newRegimeBetter && Math.abs(savings) >= 1000}
            color="amber"
          />

          {/* Slab table — new regime */}
          <div className="p-4 rounded-xl border border-border/40 bg-white/[0.01]">
            <p className="text-xs font-bold text-foreground mb-3 m-0">New Regime Slabs (FY 2025-26)</p>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-muted-foreground">
                  <th className="text-left pb-1 font-semibold">Income Slab</th>
                  <th className="text-right pb-1 font-semibold">Rate</th>
                </tr>
              </thead>
              <tbody className="space-y-1 text-muted-foreground/80">
                {[
                  ["Up to ₹4,00,000", "Nil"],
                  ["₹4L – ₹8L", "5%"],
                  ["₹8L – ₹12L", "10%"],
                  ["₹12L – ₹16L", "15%"],
                  ["₹16L – ₹20L", "20%"],
                  ["₹20L – ₹24L", "25%"],
                  ["Above ₹24L", "30%"],
                ].map(([slab, rate]) => (
                  <tr key={slab}>
                    <td className="py-0.5">{slab}</td>
                    <td className="text-right py-0.5 font-semibold">{rate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
