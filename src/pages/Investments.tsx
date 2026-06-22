import React, { useState } from "react";
import { useApp } from "../context/AppContext";
import { formatIndianCurrency, formatIndianNumberOnly } from "../lib/utils";
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
  CircleDot
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
  CartesianGrid 
} from "recharts";
import { Modal } from "../components/Modal";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import type { Investment } from "../lib/db";

// Zod validation schema allowing any string for asset type to support customs
const investmentSchema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.string().min(1, "Asset type is required"),
  quantity: z.coerce.number().nullable().optional(),
  invested_amount: z.coerce.number().positive("Invested amount must be greater than zero"),
  current_value: z.coerce.number().positive("Current value must be greater than zero"),
});

type InvestmentFormValues = z.infer<typeof investmentSchema>;

export const Investments: React.FC = () => {
  const { investments, user, showToast, refreshData, customAssetTypes, addCustomAssetType } = useApp();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingInvestment, setEditingInvestment] = useState<Investment | null>(null);
  const [timeRange, setTimeRange] = useState<"1M" | "3M" | "6M" | "1Y">("6M");

  // Summary math
  const totalInvested = investments.reduce((sum, inv) => sum + Number(inv.invested_amount), 0);
  const totalCurrentValue = investments.reduce((sum, inv) => sum + Number(inv.current_value), 0);
  const totalReturn = totalCurrentValue - totalInvested;
  const overallReturnPercent = totalInvested > 0 ? (totalReturn / totalInvested) * 100 : 0;

  // Chart data formatting: Pie Chart
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

      dynamicPieMap[formattedType] = {
        name: typeLabel,
        value: 0,
        color
      };
    }
    dynamicPieMap[formattedType].value += Number(inv.current_value);
  });

  const activePieData = Object.values(dynamicPieMap).filter((d) => d.value > 0);

  // Growth Simulator Data (Line chart)
  const generateGrowthData = (range: string) => {
    if (investments.length === 0) return [];
    
    let points = 12;
    let labelFormat = (idx: number) => `Pt ${idx}`;
    
    if (range === "1M") {
      points = 15;
      labelFormat = (idx: number) => `Day ${idx * 2}`;
    } else if (range === "3M") {
      points = 12;
      labelFormat = (idx: number) => `Wk ${idx + 1}`;
    } else if (range === "6M") {
      points = 12;
      labelFormat = (idx: number) => `Month ${idx / 2}`;
    } else if (range === "1Y") {
      points = 12;
      labelFormat = (idx: number) => {
        const months = ["Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun"];
        return months[idx % 12];
      };
    }
    
    const data = [];
    
    for (let i = 0; i < points; i++) {
      const fraction = i / (points - 1);
      const noise = Math.sin(i * 1.8) * (totalInvested * 0.012);
      const value = totalInvested + (totalReturn * fraction) + noise;
      data.push({
        name: labelFormat(i),
        value: Math.round(Math.max(0, value))
      });
    }
    return data;
  };

  const growthData = generateGrowthData(timeRange);

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this investment?")) return;
    try {
      await deleteInvestment(id);
      showToast("Investment deleted successfully", "info");
      refreshData();
    } catch (err) {
      showToast("Failed to delete investment", "error");
    }
  };

  // Combined Add/Edit Form
  const InvestmentForm: React.FC<{ onClose: () => void; investment?: Investment }> = ({ onClose, investment }) => {
    const [customTypeName, setCustomTypeName] = useState("");

    const { register, handleSubmit, watch, formState: { errors } } = useForm<any>({
      resolver: zodResolver(investmentSchema),
      defaultValues: {
        name: investment?.name || "",
        type: investment?.type || "mutual_fund",
        quantity: investment?.quantity || "",
        invested_amount: investment?.invested_amount || "",
        current_value: investment?.current_value || "",
      }
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

        const return_percent = Number((((data.current_value - data.invested_amount) / data.invested_amount) * 100).toFixed(2));
        
        if (investment) {
          await updateInvestment({
            id: investment.id,
            name: data.name,
            type: finalType,
            quantity: (finalType === "gold" || finalType === "silver" || data.quantity) ? (data.quantity || null) : null,
            invested_amount: Number(data.invested_amount),
            current_value: Number(data.current_value),
            return_percent,
          });
          showToast("Investment updated successfully", "success");
        } else {
          await addInvestment({
            user_id: user.id,
            name: data.name,
            type: finalType,
            quantity: (finalType === "gold" || finalType === "silver" || data.quantity) ? (data.quantity || null) : null,
            invested_amount: Number(data.invested_amount),
            current_value: Number(data.current_value),
            return_percent,
          });
          showToast("Investment logged successfully", "success");
        }

        refreshData();
        onClose();
      } catch (err: any) {
        showToast(err.message || "Failed to save investment", "error");
      }
    };

    const getErrorMessage = (field: any) => {
      return field?.message?.toString() || "";
    };

    const defaultTypes = [
      { value: "mutual_fund", label: "Mutual Fund 📈" },
      { value: "gold", label: "Gold 🥇" },
      { value: "silver", label: "Silver 🥈" },
      { value: "stock", label: "Stock 🚀" }
    ];

    const displayedTypes = [
      ...defaultTypes,
      ...customAssetTypes.map(t => ({ value: t, label: `${t.charAt(0).toUpperCase() + t.slice(1)} 💎` }))
    ];

    return (
      <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Name</label>
          <input
            type="text"
            placeholder="Groww Nifty 50, AuraGold etc."
            {...register("name")}
            className="w-full bg-background border border-border rounded-xl py-2.5 px-3 text-foreground text-sm focus:outline-none focus:border-gold-500"
          />
          {errors.name && <p className="text-rose-400 text-xs mt-1">{getErrorMessage(errors.name)}</p>}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Asset Type</label>
            <select
              {...register("type")}
              className="w-full bg-background border border-border rounded-xl py-2.5 px-3 text-foreground text-sm focus:outline-none focus:border-gold-500"
            >
              {displayedTypes.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
              <option value="__custom__">+ Add Custom Asset...</option>
            </select>
          </div>

          {(selectedType === "gold" || selectedType === "silver" || selectedType === "__custom__" || customAssetTypes.includes(selectedType)) && (
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Quantity (Units / Grams)</label>
              <input
                type="number"
                step="any"
                placeholder="e.g. 0.2078 or 10.0"
                {...register("quantity")}
                className="w-full bg-background border border-border rounded-xl py-2.5 px-3 text-foreground text-sm focus:outline-none focus:border-gold-500"
              />
            </div>
          )}
        </div>

        {selectedType === "__custom__" && (
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Custom Asset Type Name</label>
            <input
              type="text"
              placeholder="e.g. Real Estate, Crypto, Chit Fund"
              value={customTypeName}
              onChange={(e) => setCustomTypeName(e.target.value)}
              className="w-full bg-background border border-border rounded-xl py-2.5 px-3 text-foreground text-sm focus:outline-none focus:border-gold-500"
            />
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Invested Amount (₹)</label>
            <input
              type="number"
              step="any"
              placeholder="0.00"
              {...register("invested_amount")}
              className="w-full bg-background border border-border rounded-xl py-2.5 px-3 text-foreground text-sm focus:outline-none focus:border-gold-500"
            />
            {errors.invested_amount && <p className="text-rose-400 text-xs mt-1">{getErrorMessage(errors.invested_amount)}</p>}
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Current Value (₹)</label>
            <input
              type="number"
              step="any"
              placeholder="0.00"
              {...register("current_value")}
              className="w-full bg-background border border-border rounded-xl py-2.5 px-3 text-foreground text-sm focus:outline-none focus:border-gold-500"
            />
            {errors.current_value && <p className="text-rose-400 text-xs mt-1">{getErrorMessage(errors.current_value)}</p>}
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
            Save Investment
          </button>
        </div>
      </form>
    );
  };

  const getAssetTypeLabel = (type: string) => {
    const formatted = type.toLowerCase();
    switch (formatted) {
      case "gold": return <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-450 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-lg whitespace-nowrap"><Coins className="w-3 h-3" /> Gold</span>;
      case "silver": return <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-gray-500 dark:text-gray-400 bg-gray-500/10 border border-gray-500/20 px-2 py-0.5 rounded-lg whitespace-nowrap"><Gem className="w-3 h-3" /> Silver</span>;
      case "mutual_fund": return <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-gold-400 dark:text-gold-400 bg-gold-500/10 border border-gold-500/20 px-2 py-0.5 rounded-lg whitespace-nowrap"><TrendingUp className="w-3 h-3" /> Mutual Fund</span>;
      case "stock": return <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-cyan-500 dark:text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded-lg whitespace-nowrap"><CircleDot className="w-3 h-3" /> Stock</span>;
      default: return <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-pink-500 dark:text-pink-400 bg-pink-500/10 border border-pink-500/20 px-2 py-0.5 rounded-lg whitespace-nowrap"><CircleDot className="w-3 h-3" /> {type}</span>;
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
        
        {/* Total Value */}
        <div className="glass-card rounded-2xl p-6 border border-border flex flex-col justify-between">
          <span className="text-xs text-muted-foreground uppercase tracking-widest font-semibold block">Total Portfolio Value</span>
          <h3 className="text-3xl md:text-4xl font-extrabold text-foreground mt-2 mb-0">
            {formatIndianCurrency(totalCurrentValue)}
          </h3>
          <span className="text-xs text-muted-foreground mt-2 block">
            Across {investments.length} holdings
          </span>
        </div>

        {/* Invested Cost */}
        <div className="glass-card rounded-2xl p-6 border border-border flex flex-col justify-between">
          <span className="text-xs text-muted-foreground uppercase tracking-widest font-semibold block">Total Invested Principal</span>
          <h3 className="text-3xl font-bold text-foreground/80 mt-2 mb-0">
            {formatIndianCurrency(totalInvested)}
          </h3>
          <span className="text-xs text-muted-foreground mt-2 block">
            Net investment additions
          </span>
        </div>

        {/* P&L Return */}
        <div className="glass-card rounded-2xl p-6 border border-border flex flex-col justify-between">
          <span className="text-xs text-muted-foreground uppercase tracking-widest font-semibold block">Total Returns (P&L)</span>
          <div className="flex items-baseline gap-2 mt-2">
            <h3 className={`text-3xl font-extrabold mb-0 ${totalReturn >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
              {totalReturn >= 0 ? "+" : ""}{formatIndianCurrency(totalReturn)}
            </h3>
            <span className={`text-sm font-semibold flex items-center gap-0.5 ${totalReturn >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
              {totalReturn >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              {overallReturnPercent.toFixed(2)}%
            </span>
          </div>
          <span className="text-xs text-muted-foreground mt-2 block">
            Cumulative net gain/loss
          </span>
        </div>
      </div>

      {/* Visual Charts section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Growth Line Chart */}
        <div className="lg:col-span-2 glass-card rounded-2xl p-6 border border-border space-y-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <LineIcon className="w-5 h-5 text-gold-400" />
              <h4 className="text-base font-bold text-foreground m-0">Portfolio Growth</h4>
            </div>
            
            {/* Time Selector */}
            <div className="flex bg-muted p-0.5 rounded-lg border border-border">
              {(["1M", "3M", "6M", "1Y"] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setTimeRange(r)}
                  className={`text-[10px] md:text-xs font-bold px-2 py-1 rounded transition-all ${
                    timeRange === r ? "bg-gold-500 text-white" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div className="h-64 w-full">
            {investments.length === 0 ? (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                No investment data to display.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={growthData}>
                  <defs>
                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#C9A13E" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#C9A13E" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,120,120,0.07)" />
                  <XAxis dataKey="name" stroke="#6b7280" fontSize={11} tickLine={false} />
                  <YAxis 
                    stroke="#6b7280" 
                    fontSize={11} 
                    tickLine={false} 
                    tickFormatter={(val) => `₹${formatIndianNumberOnly(val)}`}
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: "var(--card)", borderColor: "var(--border)", borderRadius: "12px", color: "var(--foreground)" }}
                    labelClassName="text-muted-foreground text-xs"
                    formatter={(value: any) => [formatIndianCurrency(value), "Portfolio Value"]}
                  />
                  <Area type="monotone" dataKey="value" stroke="#C9A13E" strokeWidth={2.5} fillOpacity={1} fill="url(#colorValue)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Pie Asset Distribution Chart */}
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
                    contentStyle={{ backgroundColor: "var(--card)", borderColor: "var(--border)", borderRadius: "12px", color: "var(--foreground)" }}
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

      {/* Holdings list */}
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
                  <th className="pb-3 px-4">Holding Quantity</th>
                  <th className="pb-3 px-4 text-right">Invested</th>
                  <th className="pb-3 px-4 text-right">Current Value</th>
                  <th className="pb-3 px-4 text-right">Gain / Loss</th>
                  <th className="pb-3 pl-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-sm">
                {investments.map((inv) => {
                  const gainLoss = Number(inv.current_value) - Number(inv.invested_amount);
                  const isPositive = gainLoss >= 0;
                  
                  return (
                    <tr key={inv.id} className="hover:bg-muted/20 transition-colors">
                      <td className="py-3.5 pr-4 font-semibold text-foreground">{inv.name}</td>
                      <td className="py-3.5 px-4">{getAssetTypeLabel(inv.type)}</td>
                      <td className="py-3.5 px-4 text-foreground/90">
                        {inv.quantity ? `${inv.quantity}` : "—"}
                      </td>
                      <td className="py-3.5 px-4 text-right font-medium text-muted-foreground">
                        {formatIndianCurrency(inv.invested_amount)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-foreground">
                        {formatIndianCurrency(inv.current_value)}
                      </td>
                      <td className={`py-3.5 px-4 text-right font-bold ${isPositive ? "text-emerald-500" : "text-rose-500"}`}>
                        <div className="flex items-center justify-end gap-1.5">
                          <span>{isPositive ? "+" : ""}{inv.return_percent.toFixed(1)}%</span>
                          <span className="text-xs font-medium text-muted-foreground">
                            ({isPositive ? "+" : ""}{formatIndianCurrency(gainLoss)})
                          </span>
                        </div>
                      </td>
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
      <Modal isOpen={editingInvestment !== null} onClose={() => setEditingInvestment(null)} title="Edit Investment">
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
