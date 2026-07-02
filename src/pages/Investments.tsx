import React, { useState } from "react";
import { useApp } from "../context/AppContext";
import { formatIndianNumberOnly } from "../lib/utils";
import { addInvestment, deleteInvestment, updateInvestment } from "../lib/db";
import {
  Plus,
  TrendingUp,
  TrendingDown,
  Trash2,
  Edit2,
  PieChart as PieIcon,
  Coins,
  Gem,
  LineChart as LineIcon,
  CircleDot,
  RefreshCw,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { Modal } from "../components/Modal";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import type { Investment } from "../lib/db";
import { CustomSelect, NumberInput } from "../components/CustomSelect";

// ── SIP data helpers (stored in localStorage) ──────────────────────────────
const SIP_STORAGE_KEY = "investment_sip_data";

interface SipData {
  sip_amount: number;
  sip_date: number;
}

function getSipStore(): Record<string, SipData> {
  try {
    return JSON.parse(localStorage.getItem(SIP_STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveSipEntry(id: string, data: SipData) {
  const store = getSipStore();
  store[id] = data;
  localStorage.setItem(SIP_STORAGE_KEY, JSON.stringify(store));
}

function removeSipEntry(id: string) {
  const store = getSipStore();
  delete store[id];
  localStorage.setItem(SIP_STORAGE_KEY, JSON.stringify(store));
}

function getSipEntry(id: string): SipData | null {
  return getSipStore()[id] || null;
}

// ── CAGR calculation ────────────────────────────────────────────────────────
// Returns { cagr, years } so the display layer can show "< 1 yr" for fresh entries.
function calcCAGR(
  invested: number,
  currentValue: number,
  createdAt: string,
  purchaseDate?: string,
): { cagr: number; years: number } {
  const from  = purchaseDate ? purchaseDate : createdAt;
  const years = (Date.now() - new Date(from).getTime()) / (365.25 * 24 * 3600 * 1000);
  if (years < 1 / 365 || invested <= 0) return { cagr: 0, years };
  const cagr = (Math.pow(currentValue / invested, 1 / years) - 1) * 100;
  return { cagr, years };
}

// ── Format date as "12 Jun 2025" ────────────────────────────────────────────
function formatAddedOn(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

// ── Zod schema ──────────────────────────────────────────────────────────────
const investmentSchema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.string().min(1, "Asset type is required"),
  quantity: z.coerce.number().nullable().optional(),
  invested_amount: z.coerce.number().positive("Invested amount must be greater than zero"),
  current_value: z.coerce.number().positive("Current value must be greater than zero"),
  purchase_date: z.string().optional(),
});

type InvestmentFormValues = z.infer<typeof investmentSchema>;

export const Investments: React.FC = () => {
  const {
    investments,
    user,
    showToast,
    refreshData,
    customAssetTypes,
    addCustomAssetType,
    fmt: formatIndianCurrency,
  } = useApp();

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingInvestment, setEditingInvestment] = useState<Investment | null>(null);
  const [tooltipActive, setTooltipActive] = useState(false);

  // Summary math
  const totalInvested = investments.reduce((sum, inv) => sum + Number(inv.invested_amount), 0);
  const totalCurrentValue = investments.reduce((sum, inv) => sum + Number(inv.current_value), 0);
  const totalReturn = totalCurrentValue - totalInvested;
  const overallReturnPercent = totalInvested > 0 ? (totalReturn / totalInvested) * 100 : 0;

  // Pie chart data
  const colorPalette = ["#8B5CF6", "#06B6D4", "#F59E0B", "#9CA3AF", "#EC4899", "#10B981", "#3B82F6", "#EF4444"];
  const dynamicPieMap: Record<string, { name: string; value: number; color: string }> = {};

  investments.forEach((inv) => {
    const formattedType = inv.type.toLowerCase();
    const typeLabel = inv.type.charAt(0).toUpperCase() + inv.type.slice(1).replace(/_/g, " ");

    if (!dynamicPieMap[formattedType]) {
      const index = Object.keys(dynamicPieMap).length;
      let color = colorPalette[index % colorPalette.length];

      if (formattedType === "gold") color = "#F59E0B";
      else if (formattedType === "silver") color = "#9CA3AF";
      else if (formattedType === "mutual_fund") color = "#8B5CF6";
      else if (formattedType === "stock") color = "#06B6D4";

      dynamicPieMap[formattedType] = { name: typeLabel, value: 0, color };
    }
    dynamicPieMap[formattedType].value += Number(inv.current_value);
  });

  const activePieData = Object.values(dynamicPieMap).filter((d) => d.value > 0);

  // Growth chart
  const growthData = React.useMemo(() => {
    if (investments.length === 0) return [];

    const sorted = [...investments].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    const fmt = (d: Date) => d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
    const points: { name: string; invested: number; value: number }[] = [];
    let cumInvested = 0;

    const firstDate = new Date(sorted[0].created_at);
    firstDate.setDate(firstDate.getDate() - 1);
    points.push({ name: fmt(firstDate), invested: 0, value: 0 });

    sorted.forEach((inv) => {
      cumInvested += Number(inv.invested_amount);
      points.push({
        name: fmt(new Date(inv.created_at)),
        invested: Math.round(cumInvested),
        value: Math.round(cumInvested),
      });
    });

    const today = fmt(new Date());
    if (points[points.length - 1].name !== today) {
      points.push({ name: "Today", invested: Math.round(cumInvested), value: Math.round(totalCurrentValue) });
    }

    return points;
  }, [investments, totalCurrentValue]);

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this investment?")) return;
    try {
      await deleteInvestment(id);
      removeSipEntry(id);
      showToast("Investment deleted successfully", "info");
      refreshData();
    } catch (err) {
      showToast("Failed to delete investment", "error");
    }
  };

  // ── Add / Edit Form ───────────────────────────────────────────────────────
  const InvestmentForm: React.FC<{ onClose: () => void; investment?: Investment }> = ({
    onClose,
    investment,
  }) => {
    const existingSip = investment ? getSipEntry(investment.id) : null;

    const [customTypeName, setCustomTypeName] = useState("");
    const [sipMode, setSipMode] = useState<"onetime" | "sip">(
      existingSip && existingSip.sip_amount > 0 ? "sip" : "onetime"
    );
    const [sipAmount, setSipAmount] = useState(existingSip?.sip_amount?.toString() || "");
    const [sipDate, setSipDate] = useState(existingSip?.sip_date?.toString() || "1");

    // We manage invested_amount / current_value / quantity as local strings for NumberInput
    const [investedStr, setInvestedStr] = useState(investment?.invested_amount?.toString() || "");
    const [currentStr, setCurrentStr] = useState(investment?.current_value?.toString() || "");
    const [quantityStr, setQuantityStr] = useState(investment?.quantity?.toString() || "");

    const {
      register,
      handleSubmit,
      watch,
      setValue,
      control,
      formState: { errors },
    } = useForm<any>({
      resolver: zodResolver(investmentSchema),
      defaultValues: {
        name: investment?.name || "",
        type: investment?.type || "mutual_fund",
        quantity: investment?.quantity || "",
        invested_amount: investment?.invested_amount || "",
        current_value: investment?.current_value || "",
        purchase_date: investment?.purchase_date || "",
      },
    });

    const selectedType = watch("type");

    const onFormSubmit = async (data: any) => {
      if (!user) return;
      try {
        let finalType = data.type;
        if (data.type === "__custom__") {
          if (!customTypeName.trim()) {
            showToast("Please enter custom asset type", "warning");
            return;
          }
          finalType = customTypeName.trim();
          addCustomAssetType(finalType);
        }

        const return_percent = Number(
          (((data.current_value - data.invested_amount) / data.invested_amount) * 100).toFixed(2)
        );

        let savedId: string;

        if (investment) {
          await updateInvestment({
            id: investment.id,
            name: data.name,
            type: finalType,
            quantity:
              finalType === "gold" || finalType === "silver" || data.quantity
                ? data.quantity || null
                : null,
            invested_amount: Number(data.invested_amount),
            current_value: Number(data.current_value),
            return_percent,
            purchase_date: data.purchase_date || undefined,
          });
          savedId = investment.id;
          showToast("Investment updated successfully", "success");
        } else {
          await addInvestment({
            user_id: user.id,
            name: data.name,
            type: finalType,
            quantity:
              finalType === "gold" || finalType === "silver" || data.quantity
                ? data.quantity || null
                : null,
            invested_amount: Number(data.invested_amount),
            current_value: Number(data.current_value),
            return_percent,
            purchase_date: data.purchase_date || undefined,
          });
          savedId = "";
          showToast("Investment logged successfully", "success");
        }

        // Persist SIP data
        if (savedId) {
          if (sipMode === "sip" && Number(sipAmount) > 0) {
            saveSipEntry(savedId, {
              sip_amount: Number(sipAmount),
              sip_date: Math.min(28, Math.max(1, Number(sipDate) || 1)),
            });
          } else {
            removeSipEntry(savedId);
          }
        }

        refreshData();
        onClose();
      } catch (err: any) {
        showToast(err.message || "Failed to save investment", "error");
      }
    };

    const getErrorMessage = (field: any) => field?.message?.toString() || "";

    const defaultTypes = [
      { value: "mutual_fund", label: "Mutual Fund 📈" },
      { value: "gold", label: "Gold 🥇" },
      { value: "silver", label: "Silver 🥈" },
      { value: "stock", label: "Stock 🚀" },
    ];

    const displayedTypes = [
      ...defaultTypes,
      ...customAssetTypes.map((t) => ({
        value: t,
        label: `${t.charAt(0).toUpperCase() + t.slice(1)} 💎`,
      })),
      { value: "__custom__", label: "+ Add Custom Asset..." },
    ];

    const showQuantity =
      selectedType === "gold" ||
      selectedType === "silver" ||
      selectedType === "__custom__" ||
      customAssetTypes.includes(selectedType);

    return (
      <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
        {/* Name */}
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
            Name
          </label>
          <input
            type="text"
            placeholder="Groww Nifty 50, AuraGold etc."
            {...register("name")}
            className="w-full bg-background border border-border rounded-xl min-h-[48px] py-3 px-3.5 text-foreground text-sm focus:outline-none focus:border-gold-500"
          />
          {errors.name && (
            <p className="text-rose-400 text-xs mt-1">{getErrorMessage(errors.name)}</p>
          )}
        </div>

        {/* Asset Type + Quantity */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Controller
            name="type"
            control={control}
            render={({ field }) => (
              <CustomSelect
                label="Asset Type"
                options={displayedTypes}
                value={field.value}
                onChange={field.onChange}
                error={getErrorMessage(errors.type)}
              />
            )}
          />

          {showQuantity && (
            <NumberInput
              label="Quantity (Units / Grams)"
              value={quantityStr}
              onChange={(v) => {
                setQuantityStr(v);
                setValue("quantity", v);
              }}
              decimals
              placeholder="e.g. 0.2078 or 10.0"
            />
          )}
        </div>

        {/* Custom type name */}
        {selectedType === "__custom__" && (
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
              Custom Asset Type Name
            </label>
            <input
              type="text"
              placeholder="e.g. Real Estate, Crypto, Chit Fund"
              value={customTypeName}
              onChange={(e) => setCustomTypeName(e.target.value)}
              className="w-full bg-background border border-border rounded-xl min-h-[48px] py-3 px-3.5 text-foreground text-sm focus:outline-none focus:border-gold-500"
            />
          </div>
        )}

        {/* SIP Mode toggle */}
        <div className="flex items-center justify-between gap-3 p-3.5 bg-muted/40 border border-border rounded-xl">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Investment Mode
          </span>
          <div className="flex items-center gap-1 bg-background border border-border rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => setSipMode("onetime")}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                sipMode === "onetime"
                  ? "bg-gold-500 text-white shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              One-time
            </button>
            <button
              type="button"
              onClick={() => setSipMode("sip")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                sipMode === "sip"
                  ? "bg-gold-500 text-white shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <RefreshCw className="w-3 h-3" />
              SIP (Monthly)
            </button>
          </div>
        </div>

        {/* SIP fields */}
        {sipMode === "sip" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <NumberInput
              label="Monthly SIP Amount (₹)"
              value={sipAmount}
              onChange={setSipAmount}
              decimals
              prefix="₹"
              placeholder="e.g. 5000"
            />
            <NumberInput
              label="SIP Date (1–28)"
              value={sipDate}
              onChange={(v) => {
                const n = Number(v);
                if (!v || (n >= 1 && n <= 28)) setSipDate(v);
              }}
              placeholder="e.g. 5"
            />
          </div>
        )}

        {/* Invested + Current Value */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <NumberInput
              label="Invested Amount (₹)"
              value={investedStr}
              onChange={(v) => {
                setInvestedStr(v);
                setValue("invested_amount", v);
              }}
              decimals
              prefix="₹"
              placeholder="0.00"
              error={getErrorMessage(errors.invested_amount)}
            />
          </div>

          <div>
            <NumberInput
              label="Current Value (₹)"
              value={currentStr}
              onChange={(v) => {
                setCurrentStr(v);
                setValue("current_value", v);
              }}
              decimals
              prefix="₹"
              placeholder="0.00"
              error={getErrorMessage(errors.current_value)}
            />
          </div>
        </div>

        {/* Purchase Date — used for accurate CAGR */}
        <div>
          <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
            Purchase / Start Date <span className="normal-case font-normal text-muted-foreground/60">(used for CAGR — when you actually bought this)</span>
          </label>
          <input
            type="date"
            {...register("purchase_date")}
            max={new Date().toISOString().split("T")[0]}
            className="w-full bg-background border border-border rounded-xl py-2.5 px-3 text-sm text-foreground focus:outline-none focus:border-primary/60 cursor-pointer"
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
            Save Investment
          </button>
        </div>
      </form>
    );
  };

  const getAssetTypeLabel = (type: string) => {
    const formatted = type.toLowerCase();
    switch (formatted) {
      case "gold":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-450 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-lg whitespace-nowrap">
            <Coins className="w-3 h-3" /> Gold
          </span>
        );
      case "silver":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-gray-500 dark:text-gray-400 bg-gray-500/10 border border-gray-500/20 px-2 py-0.5 rounded-lg whitespace-nowrap">
            <Gem className="w-3 h-3" /> Silver
          </span>
        );
      case "mutual_fund":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-gold-400 dark:text-gold-400 bg-gold-500/10 border border-gold-500/20 px-2 py-0.5 rounded-lg whitespace-nowrap">
            <TrendingUp className="w-3 h-3" /> Mutual Fund
          </span>
        );
      case "stock":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-cyan-500 dark:text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded-lg whitespace-nowrap">
            <CircleDot className="w-3 h-3" /> Stock
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-pink-500 dark:text-pink-400 bg-pink-500/10 border border-pink-500/20 px-2 py-0.5 rounded-lg whitespace-nowrap">
            <CircleDot className="w-3 h-3" /> {type}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl md:text-3xl font-extrabold m-0 text-foreground">Investments</h2>
          <p className="text-muted-foreground text-sm mt-1">Grow your portfolio & build compound wealth</p>
        </div>
        <button
          onClick={() => setIsAddOpen(true)}
          className="btn-gold flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Add Investment
        </button>
      </div>

      {/* Portfolio overview grids */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-card rounded-2xl p-6 border border-border flex flex-col justify-between">
          <span className="text-xs text-muted-foreground uppercase tracking-widest font-semibold block">
            Total Portfolio Value
          </span>
          <h3 className="text-3xl md:text-4xl font-extrabold text-foreground mt-2 mb-0">
            {formatIndianCurrency(totalCurrentValue)}
          </h3>
          <span className="text-xs text-muted-foreground mt-2 block">
            Across {investments.length} holdings
          </span>
        </div>

        <div className="glass-card rounded-2xl p-6 border border-border flex flex-col justify-between">
          <span className="text-xs text-muted-foreground uppercase tracking-widest font-semibold block">
            Total Invested Principal
          </span>
          <h3 className="text-3xl font-bold text-foreground/80 mt-2 mb-0">
            {formatIndianCurrency(totalInvested)}
          </h3>
          <span className="text-xs text-muted-foreground mt-2 block">Net investment additions</span>
        </div>

        <div className="glass-card rounded-2xl p-6 border border-border flex flex-col justify-between">
          <span className="text-xs text-muted-foreground uppercase tracking-widest font-semibold block">
            Total Returns (P&L)
          </span>
          <div className="flex items-baseline gap-2 mt-2">
            <h3
              className={`text-3xl font-extrabold mb-0 ${
                totalReturn >= 0 ? "text-emerald-500" : "text-rose-500"
              }`}
            >
              {totalReturn >= 0 ? "+" : ""}
              {formatIndianCurrency(totalReturn)}
            </h3>
            <span
              className={`text-sm font-semibold flex items-center gap-0.5 ${
                totalReturn >= 0 ? "text-emerald-500" : "text-rose-500"
              }`}
            >
              {totalReturn >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              {overallReturnPercent.toFixed(2)}%
            </span>
          </div>
          <span className="text-xs text-muted-foreground mt-2 block">Cumulative net gain/loss</span>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Growth chart */}
        <div
          className="lg:col-span-2 glass-card rounded-2xl p-6 border border-border space-y-4"
          onTouchStart={() => setTooltipActive(false)}
        >
          <div className="flex justify-between items-center flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <LineIcon className="w-5 h-5 text-gold-400" />
              <div>
                <h4 className="text-base font-bold text-foreground m-0">Portfolio History</h4>
                <span className="text-[10px] text-muted-foreground">
                  Based on your actual investment dates
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3 text-[10px]">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-gold-400 inline-block" />
                Current Value
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                Invested
              </span>
            </div>
          </div>

          <div className="h-64 w-full">
            {investments.length === 0 ? (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                Add investments to see your portfolio history.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={growthData}
                  onMouseEnter={() => setTooltipActive(true)}
                  onMouseLeave={() => setTooltipActive(false)}
                >
                  <defs>
                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#C9A13E" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#C9A13E" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorInvested" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,120,120,0.07)" />
                  <XAxis dataKey="name" stroke="#6b7280" fontSize={10} tickLine={false} />
                  <YAxis
                    stroke="#6b7280"
                    fontSize={10}
                    tickLine={false}
                    tickFormatter={(val) => `₹${formatIndianNumberOnly(val)}`}
                    width={70}
                  />
                  {tooltipActive && (
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "var(--card)",
                        borderColor: "var(--border)",
                        borderRadius: "12px",
                        color: "var(--foreground)",
                        fontSize: 12,
                      }}
                      formatter={(value: any, name: any) => [
                        formatIndianCurrency(value),
                        name === "value" ? "Portfolio Value" : "Invested",
                      ]}
                    />
                  )}
                  <Area
                    type="stepAfter"
                    dataKey="invested"
                    stroke="#10b981"
                    strokeWidth={1.5}
                    strokeDasharray="4 2"
                    fillOpacity={1}
                    fill="url(#colorInvested)"
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#C9A13E"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#colorValue)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Pie chart */}
        <div className="glass-card rounded-2xl p-6 border border-border space-y-4 flex flex-col">
          <div className="flex items-center gap-2">
            <PieIcon className="w-5 h-5 text-gold-400" />
            <h4 className="text-base font-bold text-foreground m-0">Asset Allocation</h4>
          </div>

          <div className="flex-1 h-56 w-full relative flex items-center justify-center">
            {activePieData.length === 0 ? (
              <div className="text-muted-foreground text-sm">No assets registered.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={activePieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {activePieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--card)",
                      borderColor: "var(--border)",
                      borderRadius: "12px",
                      color: "var(--foreground)",
                    }}
                    formatter={(value: any) => [formatIndianCurrency(value), "Value"]}
                  />
                  <Legend
                    layout="horizontal"
                    verticalAlign="bottom"
                    align="center"
                    iconSize={10}
                    iconType="circle"
                    wrapperStyle={{ fontSize: "10px", paddingTop: "10px" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Holdings table */}
      <div className="glass-card rounded-2xl p-6 border border-border">
        <h4 className="text-lg font-bold text-foreground mb-4">Holdings Statement</h4>

        {investments.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            No investment holdings found. Add an investment to track portfolio appreciation.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-border text-muted-foreground text-xs uppercase font-semibold">
                  <th className="pb-3 pr-4">Investment Name</th>
                  <th className="pb-3 px-4">Asset Type</th>
                  <th className="pb-3 px-4">Quantity</th>
                  <th className="pb-3 px-4 text-right">Invested</th>
                  <th className="pb-3 px-4 text-right">Current Value</th>
                  <th className="pb-3 px-4 text-right">CAGR</th>
                  <th className="pb-3 px-4 text-right">Added On</th>
                  <th className="pb-3 pl-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-sm">
                {investments.map((inv) => {
                  const gainLoss = Number(inv.current_value) - Number(inv.invested_amount);
                  const isPositive = gainLoss >= 0;
                  const { cagr, years: cagrYears } = calcCAGR(
                    Number(inv.invested_amount),
                    Number(inv.current_value),
                    inv.created_at,
                    inv.purchase_date,
                  );
                  const sipData = getSipEntry(inv.id);
                  const hasSip = sipData && sipData.sip_amount > 0;
                  const pricePerUnit =
                    inv.quantity && Number(inv.quantity) > 0
                      ? Number(inv.current_value) / Number(inv.quantity)
                      : null;

                  return (
                    <tr key={inv.id} className="hover:bg-muted/20 transition-colors">
                      {/* Name + SIP badge */}
                      <td className="py-3.5 pr-4 font-semibold text-foreground">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span>{inv.name}</span>
                          {hasSip && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-md">
                              <RefreshCw className="w-2.5 h-2.5" />
                              SIP
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Asset type */}
                      <td className="py-3.5 px-4">{getAssetTypeLabel(inv.type)}</td>

                      {/* Quantity + Price/Unit */}
                      <td className="py-3.5 px-4 text-foreground/90">
                        <div className="flex flex-col gap-0.5">
                          <span>{inv.quantity ? `${inv.quantity}` : "—"}</span>
                          {pricePerUnit !== null && (
                            <span className="text-[10px] text-muted-foreground font-medium">
                              Price/Unit: ₹{formatIndianNumberOnly(Math.round(pricePerUnit))}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Invested */}
                      <td className="py-3.5 px-4 text-right font-medium text-muted-foreground">
                        {formatIndianCurrency(inv.invested_amount)}
                      </td>

                      {/* Current value */}
                      <td className="py-3.5 px-4 text-right font-bold text-foreground">
                        {formatIndianCurrency(inv.current_value)}
                      </td>

                      {/* CAGR + absolute gain */}
                      <td
                        className={`py-3.5 px-4 text-right font-bold ${
                          isPositive ? "text-emerald-500" : "text-rose-500"
                        }`}
                      >
                        <div className="flex flex-col items-end gap-0.5">
                          {cagrYears < 1 / 12 ? (
                            <span className="text-amber-400">
                              &lt; 1 mo
                            </span>
                          ) : cagrYears < 1 ? (
                            <span title="Less than 1 year — add Purchase Date for accurate CAGR">
                              {cagr >= 0 ? "+" : ""}{cagr.toFixed(1)}% abs.
                            </span>
                          ) : (
                            <span>
                              {cagr >= 0 ? "+" : ""}{cagr.toFixed(1)}% p.a.
                            </span>
                          )}
                          <span className="text-[10px] font-medium text-muted-foreground">
                            ({isPositive ? "+" : ""}
                            {formatIndianCurrency(gainLoss)})
                          </span>
                        </div>
                      </td>

                      {/* Added on / Purchase date */}
                      <td className="py-3.5 px-4 text-right text-muted-foreground text-xs whitespace-nowrap">
                        {inv.purchase_date ? (
                          <div className="flex flex-col items-end gap-0.5">
                            <span className="text-foreground">{formatAddedOn(inv.purchase_date)}</span>
                            <span className="text-[10px] text-muted-foreground/60">purchased</span>
                          </div>
                        ) : (
                          formatAddedOn(inv.created_at)
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 pl-4 text-right">
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => setEditingInvestment(inv)}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-gold-400 hover:bg-gold-400/10 transition-colors"
                            title="Edit Investment"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(inv.id)}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
                            title="Delete Investment"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Modal */}
      <Modal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title="Add Investment">
        <InvestmentForm onClose={() => setIsAddOpen(false)} />
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={editingInvestment !== null}
        onClose={() => setEditingInvestment(null)}
        title="Edit Investment"
      >
        {editingInvestment && (
          <InvestmentForm
            investment={editingInvestment}
            onClose={() => setEditingInvestment(null)}
          />
        )}
      </Modal>
    </div>
  );
};
