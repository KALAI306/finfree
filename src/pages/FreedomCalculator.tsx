import React, { useState, useEffect } from "react";
import { useApp } from "../context/AppContext";
import { formatIndianNumberOnly } from "../lib/utils";
import { 
  Flame, 
  HelpCircle, 
  TrendingUp, 
  Coins, 
  TrendingDown, 
  Sparkles, 
  Lightbulb,
  ArrowRight,
  Info
} from "lucide-react";
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ReferenceLine, 
  ResponsiveContainer 
} from "recharts";

export const FreedomCalculator: React.FC = () => {
  const { profile, accounts, investments, fmt: formatIndianCurrency } = useApp();

  // Baseline statistics
  const currentAge = profile ? Number(profile.age) : 23;
  const netWorth = accounts.reduce((sum, a) => sum + Number(a.balance), 0) + 
                   investments.reduce((sum, i) => sum + Number(i.current_value), 0) - 
                   (profile ? Number(profile.family_debt) : 228116);
  const positiveNetWorth = Math.max(0, netWorth);

  // States tied to sliders (initialized from Kalai's profile)
  const [monthlySalary, setMonthlySalary] = useState(20000);
  const [monthlyExpenses, setMonthlyExpenses] = useState(10000);
  const [monthlySIP, setMonthlySIP] = useState(3000);
  const [expectedReturn, setExpectedReturn] = useState(12);
  const [salaryGrowth, setSalaryGrowth] = useState(10); // salary growth per year %

  // Synchronise state with profile data on load
  useEffect(() => {
    if (profile) {
      setMonthlySalary(Number(profile.monthly_salary));
      // Estimate expenses as salary - EMI - standard savings (e.g. ₹10,000)
      setMonthlyExpenses(10000);
    }
  }, [profile]);

  // Text-buffer state for the number fields below — a bare `type="number"` bound
  // directly to a number snaps to "0" on every keystroke, making backspace/retyping
  // unusable on mobile. These buffers tolerate an empty string mid-edit.
  const [monthlySalaryStr, setMonthlySalaryStr]     = useState(String(monthlySalary));
  const [monthlyExpensesStr, setMonthlyExpensesStr] = useState(String(monthlyExpenses));
  const [monthlySIPStr, setMonthlySIPStr]           = useState(String(monthlySIP));
  const [expectedReturnStr, setExpectedReturnStr]   = useState(String(expectedReturn));
  const [salaryGrowthStr, setSalaryGrowthStr]       = useState(String(salaryGrowth));

  useEffect(() => { setMonthlySalaryStr(String(monthlySalary)); }, [monthlySalary]);
  useEffect(() => { setMonthlyExpensesStr(String(monthlyExpenses)); }, [monthlyExpenses]);
  useEffect(() => { setMonthlySIPStr(String(monthlySIP)); }, [monthlySIP]);
  useEffect(() => { setExpectedReturnStr(String(expectedReturn)); }, [expectedReturn]);
  useEffect(() => { setSalaryGrowthStr(String(salaryGrowth)); }, [salaryGrowth]);

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

  // General solver function for years to reach freedom
  const solveFreedomAge = (
    startAge: number,
    initialCorpus: number,
    salary: number,
    expenses: number,
    sip: number,
    returnRate: number,
    salGrowth: number
  ): { age: number; data: any[]; months: number } => {
    const targetCorpus = expenses * 12 * 25; // 25x rule
    let currentCorpus = initialCorpus;
    let freedomAge = 99;
    const monthlyRate = returnRate / 100 / 12;
    
    const chartData = [];
    let currentSip = sip;
    let currentSalary = salary;
    let age = startAge;
    let totalMonths = 0;

    // Track year by year
    for (let yr = 0; yr <= 35; yr++) {
      const displayAge = startAge + yr;
      
      chartData.push({
        age: displayAge,
        corpusLakhs: Number((currentCorpus / 100000).toFixed(2)),
        targetLakhs: Number((targetCorpus / 100000).toFixed(2)),
      });

      if (currentCorpus >= targetCorpus && freedomAge === 99) {
        freedomAge = displayAge;
        totalMonths = yr * 12;
      }

      // Grow salary and SIP at the end of each year
      if (yr > 0) {
        currentSalary = currentSalary * (1 + salGrowth / 100);
        // Let's assume SIP grows proportional to salary growth
        currentSip = currentSip * (1 + salGrowth / 100);
      }

      // Simulate 12 months of compounding and deposits
      for (let m = 0; m < 12; m++) {
        if (currentCorpus < targetCorpus && freedomAge === 99) {
          totalMonths++;
        }
        currentCorpus = currentCorpus * (1 + monthlyRate) + currentSip;
      }
    }

    return {
      age: freedomAge === 99 ? 99 : freedomAge,
      data: chartData,
      months: totalMonths
    };
  };

  // Run Solver for baseline
  const result = solveFreedomAge(
    currentAge,
    positiveNetWorth,
    monthlySalary,
    monthlyExpenses,
    monthlySIP,
    expectedReturn,
    salaryGrowth
  );

  // ── Interactive scenario sliders ────────────────────────────────────────────
  const [scenarioSipBoost,    setScenarioSipBoost]    = useState(500);
  const [scenarioSalaryTarget, setScenarioSalaryTarget] = useState(40000);
  const [scenarioExpenseCut,  setScenarioExpenseCut]  = useState(2000);

  const scenarioSIP = solveFreedomAge(
    currentAge, positiveNetWorth, monthlySalary, monthlyExpenses,
    monthlySIP + scenarioSipBoost, expectedReturn, salaryGrowth
  ).age;

  const scenarioSipSavings = Math.max(0, scenarioSalaryTarget - monthlySalary);
  const scenarioSalary = solveFreedomAge(
    currentAge, positiveNetWorth, scenarioSalaryTarget, monthlyExpenses,
    monthlySIP + Math.round(scenarioSipSavings * 0.5), expectedReturn, salaryGrowth
  ).age;

  const scenarioExpenses = solveFreedomAge(
    currentAge, positiveNetWorth, monthlySalary,
    Math.max(1000, monthlyExpenses - scenarioExpenseCut),
    monthlySIP, expectedReturn, salaryGrowth
  ).age;

  const targetFreedomCorpus = monthlyExpenses * 12 * 25;
  const progressPercent = targetFreedomCorpus > 0 ? (positiveNetWorth / targetFreedomCorpus) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl md:text-3xl font-extrabold m-0 text-foreground">Freedom Calculator</h2>
        <p className="text-muted-foreground text-sm mt-1">Simulate early retirement options and forecast compound portfolios</p>
      </div>

      {/* Main Big Scorecard */}
      <div className="relative overflow-hidden glass-card-gold rounded-3xl p-8 shadow-2xl text-center">
        <div className="absolute top-0 left-0 p-6 opacity-[0.06] pointer-events-none" aria-hidden="true">
          <Flame className="w-20 h-20 text-gold-400" />
        </div>
        <div className="absolute bottom-0 right-0 p-6 opacity-[0.04] pointer-events-none" aria-hidden="true">
          <TrendingUp className="w-24 h-24 text-emerald-400" />
        </div>

        <span className="text-[10px] text-gold-400/70 uppercase tracking-[0.2em] font-bold block">
          Projected Financial Freedom
        </span>

        <div className="mt-4 mb-2">
          <p className="text-sm text-muted-foreground mb-1">Freedom at age</p>
          <span className="freedom-score text-6xl md:text-7xl font-bold tracking-tight">
            {result.age === 99 ? "∞" : result.age}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8 pt-6 border-t border-white/8 text-xs md:text-sm">
          <div>
            <span className="text-muted-foreground block uppercase tracking-wider text-[10px] font-semibold">Target Corpus (25×)</span>
            <span className="stat-value text-lg font-bold text-foreground block mt-1">
              {formatIndianCurrency(targetFreedomCorpus, false)}
            </span>
          </div>
          <div className="border-y md:border-y-0 md:border-x border-white/8 py-3 md:py-0">
            <span className="text-muted-foreground block uppercase tracking-wider text-[10px] font-semibold">Current Progress</span>
            <span className="stat-value text-lg font-bold text-emerald-400 block mt-1">
              {progressPercent.toFixed(1)}%
            </span>
            <span className="text-[11px] text-muted-foreground">{formatIndianCurrency(positiveNetWorth, false)}</span>
          </div>
          <div>
            <span className="text-muted-foreground block uppercase tracking-wider text-[10px] font-semibold">Time Remaining</span>
            <span className="stat-value text-lg font-bold text-foreground block mt-1">
              {result.age === 99 ? "∞" : `${(result.months / 12).toFixed(1)} yrs`}
            </span>
            <span className="text-[11px] text-muted-foreground">{result.age === 99 ? "" : `${result.months} months`}</span>
          </div>
        </div>
      </div>

      {/* Sliders and Charts Split Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Sliders Container */}
        <div className="lg:col-span-1 glass-card rounded-2xl p-6 border border-border space-y-6">
          <h4 className="text-base font-bold text-foreground mb-2 flex items-center gap-2">
            <Coins className="w-5 h-5 text-gold-400" /> Model Sliders
          </h4>

          {/* Salary Slider */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs font-semibold">
              <span className="text-muted-foreground">Monthly Salary</span>
              <div className="flex items-center gap-1 bg-background border border-border rounded-lg px-2 py-0.5 text-foreground text-xs font-bold">
                <span className="text-muted-foreground text-[10px]">₹</span>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  value={monthlySalaryStr}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => handleBufferedNumber(e.target.value, setMonthlySalaryStr, setMonthlySalary, false)}
                  onBlur={() => { if (monthlySalaryStr === "") setMonthlySalary(15000); }}
                  className="w-16 bg-transparent text-foreground text-right focus:outline-none"
                />
              </div>
            </div>
            <input
              type="range"
              min="15000"
              max="100000"
              step="1000"
              value={monthlySalary}
              onChange={(e) => setMonthlySalary(Number(e.target.value))}
              className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-gold-500"
            />
            <div className="flex justify-between text-[9px] text-muted-foreground/80">
              <span>₹15K</span>
              <span>₹100K</span>
            </div>
          </div>

          {/* Expenses Slider */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs font-semibold">
              <span className="text-muted-foreground">Monthly Expenses</span>
              <div className="flex items-center gap-1 bg-background border border-border rounded-lg px-2 py-0.5 text-foreground text-xs font-bold">
                <span className="text-muted-foreground text-[10px]">₹</span>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  value={monthlyExpensesStr}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => handleBufferedNumber(e.target.value, setMonthlyExpensesStr, setMonthlyExpenses, false)}
                  onBlur={() => { if (monthlyExpensesStr === "") setMonthlyExpenses(0); }}
                  className="w-16 bg-transparent text-foreground text-right focus:outline-none"
                />
              </div>
            </div>
            <input
              type="range"
              min="5000"
              max="80000"
              step="500"
              value={monthlyExpenses}
              onChange={(e) => setMonthlyExpenses(Number(e.target.value))}
              className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-gold-500"
            />
            <div className="flex justify-between text-[9px] text-muted-foreground/80">
              <span>₹5K</span>
              <span>₹80K</span>
            </div>
          </div>

          {/* SIP Slider */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs font-semibold">
              <span className="text-muted-foreground">Monthly SIP Amount</span>
              <div className="flex items-center gap-1 bg-background border border-border rounded-lg px-2 py-0.5 text-foreground text-xs font-bold">
                <span className="text-muted-foreground text-[10px]">₹</span>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  value={monthlySIPStr}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => handleBufferedNumber(e.target.value, setMonthlySIPStr, setMonthlySIP, false)}
                  onBlur={() => { if (monthlySIPStr === "") setMonthlySIP(0); }}
                  className="w-16 bg-transparent text-foreground text-right focus:outline-none"
                />
              </div>
            </div>
            <input
              type="range"
              min="500"
              max="30000"
              step="500"
              value={monthlySIP}
              onChange={(e) => setMonthlySIP(Number(e.target.value))}
              className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-gold-500"
            />
            <div className="flex justify-between text-[9px] text-muted-foreground/80">
              <span>₹500</span>
              <span>₹30K</span>
            </div>
          </div>

          {/* Expected Return Slider */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs font-semibold">
              <span className="text-muted-foreground">Expected ROI (p.a.)</span>
              <div className="flex items-center gap-1 bg-background border border-border rounded-lg px-2 py-0.5 text-foreground text-xs font-bold">
                <input
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  value={expectedReturnStr}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => handleBufferedNumber(e.target.value, setExpectedReturnStr, setExpectedReturn, true)}
                  onBlur={() => { if (expectedReturnStr === "" || expectedReturnStr === ".") setExpectedReturn(0); }}
                  className="w-10 bg-transparent text-foreground text-right focus:outline-none"
                />
                <span className="text-muted-foreground text-[10px]">%</span>
              </div>
            </div>
            <input
              type="range"
              min="8"
              max="20"
              step="0.5"
              value={expectedReturn}
              onChange={(e) => setExpectedReturn(Number(e.target.value))}
              className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-gold-500"
            />
            <div className="flex justify-between text-[9px] text-muted-foreground/80">
              <span>8%</span>
              <span>20%</span>
            </div>
          </div>

          {/* Salary Growth Slider */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs font-semibold">
              <span className="text-muted-foreground">Annual Salary Growth</span>
              <div className="flex items-center gap-1 bg-background border border-border rounded-lg px-2 py-0.5 text-foreground text-xs font-bold">
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  value={salaryGrowthStr}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => handleBufferedNumber(e.target.value, setSalaryGrowthStr, setSalaryGrowth, false)}
                  onBlur={() => { if (salaryGrowthStr === "") setSalaryGrowth(0); }}
                  className="w-10 bg-transparent text-foreground text-right focus:outline-none"
                />
                <span className="text-muted-foreground text-[10px]">%</span>
              </div>
            </div>
            <input
              type="range"
              min="5"
              max="25"
              step="1"
              value={salaryGrowth}
              onChange={(e) => setSalaryGrowth(Number(e.target.value))}
              className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-gold-500"
            />
            <div className="flex justify-between text-[9px] text-muted-foreground/80">
              <span>5%</span>
              <span>25%</span>
            </div>
          </div>
        </div>

        {/* Projection Area Chart */}
        <div className="lg:col-span-2 glass-card rounded-2xl p-6 border border-border space-y-4 flex flex-col justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-gold-400" />
            <h4 className="text-base font-bold text-foreground m-0">Corpus Growth Projection</h4>
          </div>

          <div className="h-72 w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={result.data}>
                <defs>
                  <linearGradient id="colorCorpus" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#C9A13E" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#C9A13E" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(100, 100, 100, 0.08)" />
                <XAxis dataKey="age" stroke="currentColor" className="text-muted-foreground" fontSize={11} tickLine={false} />
                <YAxis 
                  stroke="currentColor" 
                  className="text-muted-foreground"
                  fontSize={11} 
                  tickLine={false} 
                  tickFormatter={(val) => `${val} L`}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "12px", color: "hsl(var(--foreground))" }}
                  itemStyle={{ color: "hsl(var(--foreground))" }}
                  formatter={(value: any) => [`₹${formatIndianNumberOnly(value * 100000)}`, "Projected Corpus"]}
                  labelFormatter={(age) => `Age: ${age}`}
                />
                <Area type="monotone" dataKey="corpusLakhs" stroke="#C9A13E" strokeWidth={2} fillOpacity={1} fill="url(#colorCorpus)" />
                <ReferenceLine 
                  y={targetFreedomCorpus / 100000} 
                  stroke="#f43f5e" 
                  strokeDasharray="4 4" 
                  label={{ value: "Freedom Target", fill: "#ef4444", fontSize: 10, position: "top" }} 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          
          <div className="text-[10px] text-muted-foreground/80 leading-relaxed">
            *Values displayed in Lakhs (L). For example, 90L = ₹90,00,000. Calculations do not factor inflation on target corpus to represent nominal numbers based on standard SIP inputs.
          </div>
        </div>
      </div>

      {/* What-If Scenarios Grid */}
      <div className="space-y-4">
        <h4 className="text-lg font-bold text-foreground mb-2 flex items-center gap-2">
          <Lightbulb className="w-5 h-5 text-gold-400" /> What-If Scenarios
        </h4>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Scenario 1 — SIP boost */}
          <div className="glass-card rounded-2xl p-5 border border-border space-y-3">
            <span className="text-[10px] text-gold-400 uppercase tracking-widest font-black block">Micro Savings Increase</span>
            <h5 className="text-sm font-bold text-foreground m-0">Boost SIP by +₹{scenarioSipBoost.toLocaleString('en-IN')}/mo</h5>
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>Extra SIP</span>
                <span className="font-semibold text-foreground">₹{scenarioSipBoost.toLocaleString('en-IN')}</span>
              </div>
              <input type="range" min={500} max={10000} step={500} value={scenarioSipBoost}
                onChange={e => setScenarioSipBoost(Number(e.target.value))}
                className="w-full accent-gold-500 bg-muted rounded-lg appearance-none h-1.5 cursor-pointer" />
              <div className="flex justify-between text-[9px] text-muted-foreground/70"><span>₹500</span><span>₹10K</span></div>
            </div>
            <div className="pt-2 flex items-center justify-between border-t border-border text-xs">
              <span className="text-muted-foreground/80">Freedom Age</span>
              <span className="font-bold text-emerald-500 flex items-center gap-1">
                Age {result.age} <ArrowRight className="w-3 h-3 text-muted-foreground" /> Age {scenarioSIP === 99 ? "∞" : scenarioSIP}
                {result.age !== 99 && scenarioSIP !== 99 && result.age - scenarioSIP > 0 && (
                  <span className="text-emerald-400 text-[10px] ml-1">(-{result.age - scenarioSIP}yr)</span>
                )}
              </span>
            </div>
          </div>

          {/* Scenario 2 — Salary target */}
          <div className="glass-card rounded-2xl p-5 border border-border space-y-3">
            <span className="text-[10px] text-gold-400 uppercase tracking-widest font-black block">Career Advancement</span>
            <h5 className="text-sm font-bold text-foreground m-0">If salary reaches ₹{scenarioSalaryTarget.toLocaleString('en-IN')}</h5>
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>Target salary</span>
                <span className="font-semibold text-foreground">₹{scenarioSalaryTarget.toLocaleString('en-IN')}</span>
              </div>
              <input type="range" min={Math.max(monthlySalary, 20000)} max={200000} step={5000} value={scenarioSalaryTarget}
                onChange={e => setScenarioSalaryTarget(Number(e.target.value))}
                className="w-full accent-gold-500 bg-muted rounded-lg appearance-none h-1.5 cursor-pointer" />
              <div className="flex justify-between text-[9px] text-muted-foreground/70"><span>₹20K</span><span>₹2L</span></div>
            </div>
            <p className="text-[10px] text-muted-foreground m-0">Saves 50% of raise as extra SIP (+₹{Math.round(scenarioSipSavings * 0.5).toLocaleString('en-IN')}/mo)</p>
            <div className="pt-2 flex items-center justify-between border-t border-border text-xs">
              <span className="text-muted-foreground/80">Freedom Age</span>
              <span className="font-bold text-emerald-500 flex items-center gap-1">
                Age {result.age} <ArrowRight className="w-3 h-3 text-muted-foreground" /> Age {scenarioSalary === 99 ? "∞" : scenarioSalary}
                {result.age !== 99 && scenarioSalary !== 99 && result.age - scenarioSalary > 0 && (
                  <span className="text-emerald-400 text-[10px] ml-1">(-{result.age - scenarioSalary}yr)</span>
                )}
              </span>
            </div>
          </div>

          {/* Scenario 3 — Expense cut */}
          <div className="glass-card rounded-2xl p-5 border border-border space-y-3">
            <span className="text-[10px] text-gold-400 uppercase tracking-widest font-black block">Frugal Adjustments</span>
            <h5 className="text-sm font-bold text-foreground m-0">Cut expenses by ₹{scenarioExpenseCut.toLocaleString('en-IN')}/mo</h5>
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>Expense cut</span>
                <span className="font-semibold text-foreground">₹{scenarioExpenseCut.toLocaleString('en-IN')}</span>
              </div>
              <input type="range" min={500} max={15000} step={500} value={scenarioExpenseCut}
                onChange={e => setScenarioExpenseCut(Number(e.target.value))}
                className="w-full accent-gold-500 bg-muted rounded-lg appearance-none h-1.5 cursor-pointer" />
              <div className="flex justify-between text-[9px] text-muted-foreground/70"><span>₹500</span><span>₹15K</span></div>
            </div>
            <p className="text-[10px] text-muted-foreground m-0">New expenses: ₹{Math.max(1000, monthlyExpenses - scenarioExpenseCut).toLocaleString('en-IN')} · also lowers 25× target</p>
            <div className="pt-2 flex items-center justify-between border-t border-border text-xs">
              <span className="text-muted-foreground/80">Freedom Age</span>
              <span className="font-bold text-emerald-500 flex items-center gap-1">
                Age {result.age} <ArrowRight className="w-3 h-3 text-muted-foreground" /> Age {scenarioExpenses === 99 ? "∞" : scenarioExpenses}
                {result.age !== 99 && scenarioExpenses !== 99 && result.age - scenarioExpenses > 0 && (
                  <span className="text-emerald-400 text-[10px] ml-1">(-{result.age - scenarioExpenses}yr)</span>
                )}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
