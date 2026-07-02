import React, { useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "../context/AppContext";
import { getPreference, setPreference } from "../lib/db";
import {
  fetchQuotes,
  searchSymbols,
  fmtQuotePrice,
  DEFAULT_INDICES,
  INDEX_LABELS,
  type MarketQuote,
  type SymbolSearchResult,
} from "../lib/market";
import {
  TrendingUp,
  TrendingDown,
  Search,
  Plus,
  X,
  RefreshCw,
  LineChart,
  Star,
} from "lucide-react";

// Shown when the user hasn't built a watchlist yet (not persisted until they add/remove)
const STARTER_WATCHLIST = ["RELIANCE.NS", "TCS.NS", "HDFCBANK.NS", "INFY.NS", "AAPL"];

const ChangeChip: React.FC<{ q: MarketQuote }> = ({ q }) => {
  const up = q.change_percent >= 0;
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-lg ${
        up ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
      }`}
    >
      {up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {up ? "+" : ""}
      {q.change_percent.toFixed(2)}%
    </span>
  );
};

export const Markets: React.FC = () => {
  const { user, showToast } = useApp();
  const [indices, setIndices] = useState<MarketQuote[]>([]);
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [watchlistLoaded, setWatchlistLoaded] = useState(false);
  const [quotes, setQuotes] = useState<Record<string, MarketQuote>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Search state
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SymbolSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const effectiveList = watchlist.length > 0 ? watchlist : STARTER_WATCHLIST;

  // Load persisted watchlist
  useEffect(() => {
    if (!user?.id) return;
    getPreference<string[]>(user.id, "watchlist")
      .then((wl) => { if (wl && wl.length > 0) setWatchlist(wl); })
      .catch(() => {})
      .finally(() => setWatchlistLoaded(true));
  }, [user?.id]);

  const loadQuotes = React.useCallback(async (symbols: string[]) => {
    setRefreshing(true);
    try {
      const [idx, wl] = await Promise.all([
        fetchQuotes(DEFAULT_INDICES),
        fetchQuotes(symbols),
      ]);
      setIndices(idx.filter((q) => !q.error));
      setQuotes(Object.fromEntries(wl.map((q) => [q.symbol, q])));
      setLastUpdated(new Date());
    } catch (e: any) {
      showToast(e.message || "Failed to load market data", "error");
    } finally {
      setRefreshing(false);
    }
  }, [showToast]);

  // Initial load + 60s auto-refresh (matches server cache TTL)
  useEffect(() => {
    if (!watchlistLoaded) return;
    loadQuotes(effectiveList);
    const t = setInterval(() => loadQuotes(effectiveList), 60_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchlistLoaded, watchlist.join(",")]);

  // Debounced symbol search
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (query.trim().length < 2) { setResults([]); return; }
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try { setResults(await searchSymbols(query)); } catch { setResults([]); }
      finally { setSearching(false); }
    }, 400);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [query]);

  const persistWatchlist = (updated: string[]) => {
    setWatchlist(updated);
    if (user?.id) setPreference(user.id, "watchlist", updated).catch(() => {});
  };

  const addSymbol = (sym: string) => {
    const base = watchlist.length > 0 ? watchlist : STARTER_WATCHLIST;
    if (base.includes(sym)) { showToast("Already in watchlist", "info"); return; }
    persistWatchlist([...base, sym]);
    setQuery("");
    setResults([]);
    showToast(`${sym} added to watchlist`, "success");
  };

  const removeSymbol = (sym: string) => {
    const base = watchlist.length > 0 ? watchlist : STARTER_WATCHLIST;
    persistWatchlist(base.filter((s) => s !== sym));
  };

  const sortedQuotes = useMemo(
    () => effectiveList.map((s) => quotes[s]).filter(Boolean) as MarketQuote[],
    [effectiveList, quotes]
  );

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <LineChart className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Markets</h1>
          <p className="text-xs text-muted-foreground">
            Live prices — NSE, BSE, US stocks, mutual funds &amp; crypto
          </p>
        </div>
        <button
          onClick={() => loadQuotes(effectiveList)}
          disabled={refreshing}
          className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg px-3 py-1.5 transition-colors cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
          {lastUpdated ? lastUpdated.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "Refresh"}
        </button>
      </div>

      {/* Indices strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {(indices.length ? indices : DEFAULT_INDICES.map((s) => null)).map((q, i) =>
          q ? (
            <div key={q.symbol} className="hero-card p-3.5">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                {INDEX_LABELS[q.symbol] || q.name}
              </p>
              <p className="text-base font-bold text-foreground mt-1">{fmtQuotePrice(q)}</p>
              <div className="mt-1"><ChangeChip q={q} /></div>
            </div>
          ) : (
            <div key={i} className="hero-card p-3.5 animate-pulse">
              <div className="h-3 w-16 bg-muted rounded" />
              <div className="h-5 w-20 bg-muted rounded mt-2" />
              <div className="h-4 w-14 bg-muted rounded mt-2" />
            </div>
          )
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <div className="flex items-center gap-2 bg-background border border-border rounded-xl px-3">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search stocks, mutual funds, crypto… (e.g. Reliance, TCS, Nifty BeES)"
            className="flex-1 bg-transparent py-3 text-sm text-foreground focus:outline-none"
          />
          {searching && <RefreshCw className="w-4 h-4 text-muted-foreground animate-spin shrink-0" />}
        </div>

        {results.length > 0 && (
          <div className="absolute z-30 mt-2 w-full hero-card overflow-hidden max-h-80 overflow-y-auto">
            {results.map((r) => (
              <button
                key={r.symbol}
                onClick={() => addSymbol(r.symbol)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors cursor-pointer text-left border-b border-border last:border-0"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{r.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {r.symbol} · {r.exchange}
                  </p>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/10 text-primary shrink-0">
                  {r.type === "MUTUALFUND" ? "MF" : r.type}
                </span>
                <Plus className="w-4 h-4 text-muted-foreground shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Watchlist */}
      <div className="hero-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center gap-2">
          <Star className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">Watchlist</span>
          {watchlist.length === 0 && (
            <span className="text-[11px] text-muted-foreground">(starter list — add symbols to make it yours)</span>
          )}
          <span className="ml-auto text-xs text-muted-foreground">{effectiveList.length} symbols</span>
        </div>

        {sortedQuotes.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground text-sm gap-2">
            <RefreshCw className="w-4 h-4 animate-spin" /> Loading quotes…
          </div>
        ) : (
          <div className="divide-y divide-border">
            {sortedQuotes.map((q) => (
              <div key={q.symbol} className="flex items-center gap-3 px-5 py-3.5 group">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{q.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {q.symbol} · {q.exchange}
                    {q.nav_date ? ` · NAV ${q.nav_date}` : ""}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-foreground">{fmtQuotePrice(q)}</p>
                  <ChangeChip q={q} />
                </div>
                <button
                  onClick={() => removeSymbol(q.symbol)}
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-rose-400 transition-all cursor-pointer p-1"
                  aria-label={`Remove ${q.symbol} from watchlist`}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="text-[11px] text-muted-foreground text-center">
        Prices update every minute. Mutual fund NAVs update once daily. Data via NSE/BSE (Yahoo), Finnhub &amp; AMFI.
      </p>
    </div>
  );
};
