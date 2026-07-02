import React, { useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "../context/AppContext";
import { getPreference, setPreference } from "../lib/db";
import {
  fetchQuotes,
  searchSymbols,
  fmtQuotePrice,
  INDEX_LABELS,
  MARKET_REGIONS,
  type MarketQuote,
  type SymbolSearchResult,
} from "../lib/market";
import { StockDetail } from "../components/StockDetail";
import {
  TrendingUp,
  TrendingDown,
  Search,
  Plus,
  X,
  RefreshCw,
  LineChart,
  Star,
  ChevronRight,
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
  const [region, setRegion] = useState(MARKET_REGIONS[0].key);
  const [detailSymbol, setDetailSymbol] = useState<string | null>(null);

  // Search state
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SymbolSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchBoxRef = useRef<HTMLDivElement>(null);

  // Close the search results dropdown when tapping/clicking anywhere outside it
  useEffect(() => {
    const handler = (e: PointerEvent) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) {
        setResults([]);
      }
    };
    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, []);

  const effectiveList = watchlist.length > 0 ? watchlist : STARTER_WATCHLIST;

  // Load persisted watchlist
  useEffect(() => {
    if (!user?.id) return;
    getPreference<string[]>(user.id, "watchlist")
      .then((wl) => { if (wl && wl.length > 0) setWatchlist(wl); })
      .catch(() => {})
      .finally(() => setWatchlistLoaded(true));
  }, [user?.id]);

  const regionSymbols = MARKET_REGIONS.find((r) => r.key === region)!.symbols;

  const loadQuotes = React.useCallback(async (symbols: string[], idxSymbols: string[]) => {
    setRefreshing(true);
    try {
      const [idx, wl] = await Promise.all([
        fetchQuotes(idxSymbols),
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
    loadQuotes(effectiveList, regionSymbols);
    const t = setInterval(() => loadQuotes(effectiveList, regionSymbols), 60_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchlistLoaded, watchlist.join(","), region]);

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
          onClick={() => loadQuotes(effectiveList, regionSymbols)}
          disabled={refreshing}
          className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg px-3 py-1.5 transition-colors cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
          {lastUpdated ? lastUpdated.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "Refresh"}
        </button>
      </div>

      {/* Region tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
        {MARKET_REGIONS.map((r) => (
          <button
            key={r.key}
            onClick={() => setRegion(r.key)}
            className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
              region === r.key
                ? "bg-primary text-primary-foreground"
                : "bg-muted/40 text-muted-foreground hover:text-foreground"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* Indices strip — click any to open the detailed chart */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {(indices.length ? indices : regionSymbols.map(() => null)).map((q, i) =>
          q ? (
            <button
              key={q.symbol}
              onClick={() => setDetailSymbol(q.symbol)}
              className="hero-card p-3.5 text-left hover:border-primary/40 transition-colors cursor-pointer group"
            >
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                {INDEX_LABELS[q.symbol] || q.name}
                <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
              </p>
              <p className="text-base font-bold text-foreground mt-1">{fmtQuotePrice(q)}</p>
              <div className="mt-1"><ChangeChip q={q} /></div>
            </button>
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
      <div className="relative" ref={searchBoxRef}>
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
                <button
                  onClick={() => setDetailSymbol(q.symbol)}
                  className="flex-1 min-w-0 text-left cursor-pointer"
                >
                  <p className="text-sm font-semibold text-foreground truncate hover:text-primary transition-colors">{q.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {q.symbol} · {q.exchange}
                    {q.nav_date ? ` · NAV ${q.nav_date}` : ""}
                  </p>
                </button>
                <button onClick={() => setDetailSymbol(q.symbol)} className="text-right cursor-pointer">
                  <p className="text-sm font-bold text-foreground">{fmtQuotePrice(q)}</p>
                  <ChangeChip q={q} />
                </button>
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

      {detailSymbol && (
        <StockDetail
          symbol={detailSymbol}
          onClose={() => setDetailSymbol(null)}
          inWatchlist={effectiveList.includes(detailSymbol)}
          onToggleWatchlist={(sym) => {
            const base = watchlist.length > 0 ? watchlist : STARTER_WATCHLIST;
            if (base.includes(sym)) { persistWatchlist(base.filter((s) => s !== sym)); showToast("Removed from watchlist", "info"); }
            else { persistWatchlist([...base, sym]); showToast("Added to watchlist", "success"); }
          }}
        />
      )}
    </div>
  );
};
