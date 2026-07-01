/**
 * FinFree AI — Worker Client
 * Follows the same pattern as the L2L sample project:
 *   Frontend sends { query, userId, context_str }
 *   Worker returns { reply } or { tool_call }
 */

import type { Profile, Account, Transaction, Investment, EMI, Goal } from './db';

const WORKER_URL = (import.meta.env.VITE_AI_WORKER_URL as string || '').replace(/\/$/, '');

// ── Context builder ──────────────────────────────────────────────────────────
// Formats all financial data into a compact text snapshot sent to the worker.

export function buildContextStr(
  profile:      Profile | null,
  accounts:     Account[],
  transactions: Transaction[],
  investments:  Investment[],
  emis:         EMI[],
  goals:        Goal[],
): string {
  const d  = new Date();
  const cm = d.getMonth();
  const cy = d.getFullYear();

  const monthTxs  = transactions.filter(t => {
    const td = new Date(t.date);
    return td.getMonth() === cm && td.getFullYear() === cy;
  });
  const monthInc  = monthTxs.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
  const monthExp  = monthTxs.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
  const totalBal  = accounts.reduce((s, a) => s + Number(a.balance), 0);
  const totalInv  = investments.reduce((s, i) => s + Number(i.current_value || 0), 0);
  const totalEmi  = emis.reduce((s, e) => s + Number(e.emi_amount), 0);
  const netWorth  = totalBal + totalInv - Number(profile?.family_debt || 0);
  const fmt       = (n: number) => `₹${n.toLocaleString('en-IN')}`;

  const lines: string[] = [
    `Name: ${profile?.name || 'User'} | Age: ${profile?.age || '-'} | Salary: ${fmt(Number(profile?.monthly_salary || 0))}/mo`,
    `Net Worth: ${fmt(netWorth)} | Family Debt: ${fmt(Number(profile?.family_debt || 0))}`,
    `Freedom Target: ${fmt(Number(profile?.freedom_target || 0))} by age ${profile?.target_freedom_age || '-'}`,
    '',
    `This Month → Income: ${fmt(monthInc)} | Expenses: ${fmt(monthExp)} | Saved: ${fmt(monthInc - monthExp)}`,
    '',
    `Accounts (total ${fmt(totalBal)}):`,
    ...accounts.map(a => `  • ${a.name} [ID:${a.id}] (${a.type}): ${fmt(Number(a.balance))}`),
    accounts.length === 0 ? '  None' : '',
    `EMIs (${fmt(totalEmi)}/mo):`,
    ...emis.map(e => `  • ${e.name}: ${fmt(Number(e.emi_amount))}/mo`),
    emis.length === 0 ? '  None' : '',
    `Goals:`,
    ...goals.map(g => `  • ${g.name} [ID:${g.id}]: ${fmt(Number(g.current_amount))} / ${fmt(Number(g.target_amount))}`),
    goals.length === 0 ? '  None' : '',
    `Investments (total ${fmt(totalInv)}):`,
    ...investments.map(i => `  • ${i.name} (${i.type}): ${fmt(Number(i.current_value || 0))}`),
    investments.length === 0 ? '  None' : '',
    `Recent Transactions (last 20):`,
    ...transactions.slice(0, 20).map(t =>
      `  • ${t.date} | ${t.type === 'income' ? '+' : '-'}${fmt(Number(t.amount))} | ${t.category} | ${t.note || ''}`
    ),
    transactions.length === 0 ? '  None' : '',
  ];

  return lines.filter(l => l !== undefined).join('\n');
}

// ── Core worker caller ───────────────────────────────────────────────────────

async function callWorker(endpoint: string, payload: Record<string, any>, userId?: string): Promise<any> {
  if (!WORKER_URL) {
    throw new Error('VITE_AI_WORKER_URL is not configured. Ask your admin to set it up.');
  }
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (userId) headers['X-User-ID'] = userId;

  const res  = await fetch(`${WORKER_URL}/api/${endpoint}`, {
    method: 'POST',
    headers,
    body:   JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok || !data.ok) throw new Error(data.error || `Worker error ${res.status}`);
  return data;
}

// ── Chat ─────────────────────────────────────────────────────────────────────

export async function chatWithAI(
  query:       string,
  userId:      string,
  contextStr:  string,
  onToolCall:  (name: string, args: Record<string, any>) => Promise<string>,
): Promise<string> {
  const data = await callWorker('chat', { query, userId, context_str: contextStr }, userId);

  // Worker returned a tool call → execute client-side (DB write to Supabase/local)
  if (data.tool_call) {
    const tc = data.tool_call;
    let toolResult: string;
    try {
      toolResult = await onToolCall(tc.name, tc.args);
    } catch (e: any) {
      toolResult = `Error: ${e.message}`;
    }
    // Send tool result back for a friendly confirmation message
    const final = await callWorker('chat', {
      query:       `[Tool result for ${tc.name}]: ${toolResult}. Give the user a short, friendly confirmation.`,
      userId,
      context_str: contextStr,
    }, userId);
    return final.reply || toolResult;
  }

  return data.reply || "Sorry, I couldn't generate a response.";
}

// ── Statement parser ─────────────────────────────────────────────────────────

export interface ParsedAITransaction {
  date:     string;
  amount:   number;
  type:     'income' | 'expense';
  note:     string;
  category: string;
}

export async function parseStatementWithAI(
  statementText: string,
  userId?: string,
): Promise<ParsedAITransaction[]> {
  const data = await callWorker('parse-statement', {
    statement_text: statementText,
    userId: userId || '',
  }, userId);
  return Array.isArray(data.transactions) ? data.transactions : [];
}

// ── Settings API (admin only) ────────────────────────────────────────────────

export interface AISettings {
  ai_provider:         string;
  ai_gemini_model:     string;
  ai_groq_model:       string;
  ai_hf_model:         string;
  ai_openrouter_model: string;
  ai_key_gemini_1:     string;
  ai_key_gemini_2:     string;
  ai_key_gemini_3:     string;
  ai_key_groq_1:       string;
  ai_key_hf_1:         string;
  ai_key_openrouter_1: string;
  ai_persona:          string;
  [key: string]: string;
}

export async function fetchAISettings(): Promise<AISettings> {
  if (!WORKER_URL) throw new Error('VITE_AI_WORKER_URL not set');
  const res  = await fetch(`${WORKER_URL}/api/settings`);
  const data = await res.json();
  return data.settings || {};
}

export async function updateAISetting(key: string, value: string): Promise<void> {
  if (!WORKER_URL) throw new Error('VITE_AI_WORKER_URL not set');
  await fetch(`${WORKER_URL}/api/settings`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ key, value }),
  });
}

// ── Logs API ─────────────────────────────────────────────────────────────────

export interface AIUsageLog {
  id:                string;
  endpoint:          string;
  user_id:           string;
  provider:          string;
  model:             string;
  prompt_tokens:     number;
  completion_tokens: number;
  total_tokens:      number;
  latency_ms:        number;
  success:           number;
  created_at:        string;
}

export async function fetchAILogs(limit = 100): Promise<AIUsageLog[]> {
  if (!WORKER_URL) throw new Error('VITE_AI_WORKER_URL not set');
  const res  = await fetch(`${WORKER_URL}/api/logs?limit=${limit}`);
  const data = await res.json();
  return data.logs || [];
}

// ── Memory API ───────────────────────────────────────────────────────────────

export interface AIMemoryItem {
  id:         string;
  memory:     string;
  created_at: string;
}

export async function fetchAIMemory(userId: string): Promise<AIMemoryItem[]> {
  if (!WORKER_URL || !userId) return [];
  const res  = await fetch(`${WORKER_URL}/api/memory`, { headers: { 'X-User-ID': userId } });
  const data = await res.json();
  return data.memory || [];
}

export async function clearAIMemory(userId: string): Promise<void> {
  if (!WORKER_URL || !userId) return;
  await fetch(`${WORKER_URL}/api/memory`, {
    method:  'DELETE',
    headers: { 'X-User-ID': userId },
  });
}

// ── Health API ───────────────────────────────────────────────────────────────

export async function fetchAIHealth(): Promise<{ status: string; total_ai_calls: number; keys_configured: number }> {
  if (!WORKER_URL) return { status: 'unconfigured', total_ai_calls: 0, keys_configured: 0 };
  try {
    const res  = await fetch(`${WORKER_URL}/api/health`);
    const data = await res.json();
    return data;
  } catch {
    return { status: 'offline', total_ai_calls: 0, keys_configured: 0 };
  }
}
