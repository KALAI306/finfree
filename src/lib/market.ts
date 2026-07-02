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
  '^NSEI':   'NIFTY 50',
  '^BSESN':  'SENSEX',
  'USDINR=X':'USD/INR',
  'BTC-USD': 'Bitcoin',
  'GC=F':    'Gold',
};
