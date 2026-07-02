import React, { useEffect, useState } from "react";
import {
  fetchChart,
  CHART_RANGES,
  type ChartData,
} from "../lib/market";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { X, TrendingUp, TrendingDown, Star, RefreshCw } from "lucide-react";

const cur = (c: string) => (c === "INR" ? "₹" : c === "USD" ? "$" : c === "GBP" ? "£" : c === "EUR" ? "€" : "");

const StatCell: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex flex-col">
    <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">{label}</span>
    <span className="text-sm font-bold text-foreground">{value}</span>
  </div>
);

export const StockDetail: React.FC<{
  symbol: string;
  onClose: () => void;
  inWatchlist: boolean;
  onToggleWatchlist: (sym: string) => void;
}> = ({ symbol, onClose, inWatchlist, onToggleWatchlist }) => {
  const [rangeKey, setRangeKey] = useState("1M");
  const [chart, setChart] = useState<ChartData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const r = CHART_RANGES.find((x) => x.key === rangeKey)!;
    setLoading(true);
    setError("");
    fetchChart(symbol, r.range, r.interval)
      .then(setChart)
      .catch((e) => setError(e.message || "Failed to load chart"))
      .finally(() => setLoading(false));
  }, [symbol, rangeKey]);

  const symbolPrefix = cur(chart?.currency || "");
  const price = chart?.price ?? null;
  const prev = chart?.prev_close ?? (chart?.points.length ? chart.points[0].c : null);
  const change = price !== null && prev !== null ? price - prev : 0;
  const changePct = price !== null && prev ? (change / prev) * 100 : 0;
  const up = change >= 0;
  const stroke = up ? "#10b981" : "#f43f5e";

  const fmtPrice = (n: number | null) =>
    n === null ? "—" : `${symbolPrefix}${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

  const fmtAxisTime = (t: number) => {
    const d = new Date(t);
    if (rangeKey === "1D" || rangeKey === "5D")
      return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
    if (rangeKey === "5Y" || rangeKey === "MAX")
      return d.toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
      <div className="hero-card w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-start gap-3 px-5 py-4 border-b border-border bg-card/95 backdrop-blur">
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-foreground truncate">{chart?.name || symbol}</h2>
            <p className="text-[11px] text-muted-foreground">
              {symbol}
              {chart?.exchange ? ` · ${chart.exchange}` : ""}
            </p>
          </div>
          <button
            onClick={() => onToggleWatchlist(symbol)}
            className={`p-2 rounded-lg transition-colors cursor-pointer ${
              inWatchlist ? "text-amber-400 bg-amber-400/10" : "text-muted-foreground hover:text-foreground"
            }`}
            title={inWatchlist ? "Remove from watchlist" : "Add to watchlist"}
          >
            <Star className={`w-4 h-4 ${inWatchlist ? "fill-amber-400" : ""}`} />
          </button>
          <button onClick={onClose} className="p-2 rounded-lg text-muted-foreground hover:text-foreground cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Price */}
          <div className="flex items-baseline gap-3 flex-wrap">
            <span className="text-3xl font-extrabold text-foreground">{fmtPrice(price)}</span>
            <span
              className={`inline-flex items-center gap-1 text-sm font-bold px-2 py-0.5 rounded-lg ${
                up ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
              }`}
            >
              {up ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
              {up ? "+" : ""}
              {fmtPrice(Math.abs(change)).replace(symbolPrefix, symbolPrefix)} ({up ? "+" : ""}
              {changePct.toFixed(2)}%)
            </span>
          </div>

          {/* Range selector */}
          <div className="flex items-center gap-1 flex-wrap">
            {CHART_RANGES.map((r) => (
              <button
                key={r.key}
                onClick={() => setRangeKey(r.key)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  rangeKey === r.key
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          {/* Chart */}
          <div className="h-64 w-full">
            {loading ? (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm gap-2">
                <RefreshCw className="w-4 h-4 animate-spin" /> Loading chart…
              </div>
            ) : error ? (
              <div className="h-full flex items-center justify-center text-rose-400 text-sm">{error}</div>
            ) : chart && chart.points.length > 1 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chart.points}>
                  <defs>
                    <linearGradient id="detailFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={stroke} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={stroke} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,120,120,0.08)" />
                  <XAxis
                    dataKey="t"
                    tickFormatter={fmtAxisTime}
                    stroke="#6b7280"
                    fontSize={10}
                    tickLine={false}
                    minTickGap={40}
                  />
                  <YAxis
                    domain={["auto", "auto"]}
                    stroke="#6b7280"
                    fontSize={10}
                    tickLine={false}
                    width={60}
                    tickFormatter={(v) => `${symbolPrefix}${Number(v).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--card)",
                      borderColor: "var(--border)",
                      borderRadius: "12px",
                      fontSize: 12,
                    }}
                    labelFormatter={(t) => new Date(t as number).toLocaleString("en-IN")}
                    formatter={(v: any) => [fmtPrice(Number(v)), "Price"]}
                  />
                  <Area type="monotone" dataKey="c" stroke={stroke} strokeWidth={2} fill="url(#detailFill)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                No chart data for this range.
              </div>
            )}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2 border-t border-border">
            <StatCell label="Prev Close" value={fmtPrice(prev)} />
            {chart?.day_low != null && chart?.day_high != null && (
              <StatCell label="Day Range" value={`${fmtPrice(chart.day_low)} – ${fmtPrice(chart.day_high)}`} />
            )}
            {chart?.fifty_two_low != null && chart?.fifty_two_high != null && (
              <StatCell label="52-Wk Range" value={`${fmtPrice(chart.fifty_two_low)} – ${fmtPrice(chart.fifty_two_high)}`} />
            )}
            <StatCell label="Source" value={(chart?.source || "").toUpperCase()} />
          </div>
        </div>
      </div>
    </div>
  );
};
