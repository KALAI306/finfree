/**
 * FinFree Markets — live quote client
 * All requests proxy through the Cloudflare Worker, which routes by symbol:
 *   MF:<code>            → mfapi.in (Indian mutual funds)
 *   *.NS / *.BO / ^* / *=X / *-USD → Yahoo Finance
 *   plain US tickers     → Finnhub (admin-configured key), Yahoo fallback
 * Quotes are cached 60s server-side, so polling is cheap.
 */

const WORKER_URL = (import.meta.env.VITE_AI_WORKER_URL as string || '').replace(/\/$/, '');

export interface MarketQuote {
  symbol: string;
  name: string;
  price: number;
  prev_close: number;
  change: number;
  change_percent: number;
  currency: string;
  exchange: string;
  nav_date?: string;
  source: string;
  error?: string;
}

export interface SymbolSearchResult {
  symbol: string;
  name: string;
  exchange: string;
  type: string;
}

export async function fetchQuotes(symbols: string[]): Promise<MarketQuote[]> {
  if (!WORKER_URL || symbols.length === 0) return [];
  const res = await fetch(`${WORKER_URL}/api/market/quote?symbols=${encodeURIComponent(symbols.join(','))}`);
  const data = await res.json();
  if (!res.ok || !data.ok) throw new Error(data.error || `Market error ${res.status}`);
  return data.quotes || [];
}

export interface ChartPoint { t: number; c: number; }
export interface ChartData {
  symbol: string;
  name: string;
  currency: string;
  exchange: string;
  price: number | null;
  prev_close: number | null;
  day_high?: number | null;
  day_low?: number | null;
  fifty_two_high?: number | null;
  fifty_two_low?: number | null;
  points: ChartPoint[];
  source: string;
}

// Google-Finance-style ranges → Yahoo range/interval pairs
export const CHART_RANGES: { key: string; label: string; range: string; interval: string }[] = [
  { key: "1D",  label: "1D",  range: "1d",  interval: "5m"  },
  { key: "5D",  label: "5D",  range: "5d",  interval: "30m" },
  { key: "1M",  label: "1M",  range: "1mo", interval: "1d"  },
  { key: "6M",  label: "6M",  range: "6mo", interval: "1d"  },
  { key: "YTD", label: "YTD", range: "ytd", interval: "1d"  },
  { key: "1Y",  label: "1Y",  range: "1y",  interval: "1d"  },
  { key: "5Y",  label: "5Y",  range: "5y",  interval: "1wk" },
  { key: "MAX", label: "Max", range: "max", interval: "1mo" },
];

export async function fetchChart(symbol: string, range = "1mo", interval = "1d"): Promise<ChartData> {
  if (!WORKER_URL) throw new Error("Market data not configured");
  const res = await fetch(
    `${WORKER_URL}/api/market/chart?symbol=${encodeURIComponent(symbol)}&range=${range}&interval=${interval}`
  );
  const data = await res.json();
  if (!res.ok || !data.ok) throw new Error(data.error || `Chart error ${res.status}`);
  return data.chart;
}

export async function searchSymbols(q: string): Promise<SymbolSearchResult[]> {
  if (!WORKER_URL || q.trim().length < 2) return [];
  const res = await fetch(`${WORKER_URL}/api/market/search?q=${encodeURIComponent(q.trim())}`);
  const data = await res.json();
  if (!res.ok || !data.ok) throw new Error(data.error || `Search error ${res.status}`);
  return data.results || [];
}

/** Format a price in its native currency (₹ for INR, $ for USD). */
export function fmtQuotePrice(q: MarketQuote): string {
  const sym = q.currency === 'INR' ? '₹' : q.currency === 'USD' ? '$' : '';
  return `${sym}${q.price.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

/** Default indices strip shown on the Markets page. */
export const DEFAULT_INDICES = ['^NSEI', '^BSESN', 'USDINR=X', 'BTC-USD', 'GC=F'];
export const INDEX_LABELS: Record<string, string> = {
  '^NSEI':    'NIFTY 50',
  '^BSESN':   'SENSEX',
  '^NSEBANK': 'NIFTY Bank',
  '^CNXIT':   'NIFTY IT',
  'USDINR=X': 'USD/INR',
  'BTC-USD':  'Bitcoin',
  'ETH-USD':  'Ethereum',
  'GC=F':     'Gold',
  'CL=F':     'Crude Oil',
  '^GSPC':    'S&P 500',
  '^IXIC':    'Nasdaq',
  '^DJI':     'Dow Jones',
  '^FTSE':    'FTSE 100',
  '^GDAXI':   'DAX',
  '^N225':    'Nikkei 225',
  'EURUSD=X': 'EUR/USD',
  'GBPUSD=X': 'GBP/USD',
};

// Region tabs, Google-Finance style
export const MARKET_REGIONS: { key: string; label: string; symbols: string[] }[] = [
  { key: "india",  label: "India",  symbols: ["^NSEI", "^BSESN", "^NSEBANK", "^CNXIT"] },
  { key: "us",     label: "US",     symbols: ["^GSPC", "^IXIC", "^DJI"] },
  { key: "world",  label: "World",  symbols: ["^FTSE", "^GDAXI", "^N225"] },
  { key: "crypto", label: "Crypto", symbols: ["BTC-USD", "ETH-USD"] },
  { key: "fx",     label: "Currencies", symbols: ["USDINR=X", "EURUSD=X", "GBPUSD=X"] },
  { key: "commodities", label: "Commodities", symbols: ["GC=F", "CL=F"] },
];
