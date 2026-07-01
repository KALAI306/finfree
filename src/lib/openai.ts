/**
 * FinFree AI — Worker Client
 * All AI calls now route through the Cloudflare Worker.
 * API key is stored securely in Wrangler secrets — never exposed to the browser.
 */

import type { Profile, Account, Transaction, Investment, EMI, Goal } from './db';

// ── Config ─────────────────────────────────────────────────────────────────

const WORKER_URL = import.meta.env.VITE_AI_WORKER_URL as string || '';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface FinancialContext {
  profile:      Profile | null;
  accounts:     Account[];
  transactions: Transaction[];
  investments:  Investment[];
  emis:         EMI[];
  goals:        Goal[];
}

export interface ToolCall {
  name: string;
  args: Record<string, any>;
}

// ── Core worker caller ──────────────────────────────────────────────────────

async function callWorker(endpoint: string, payload: Record<string, any>, userId?: string): Promise<any> {
  if (!WORKER_URL) {
    throw new Error('VITE_AI_WORKER_URL is not set. Please configure it in your .env file.');
  }
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (userId) headers['X-User-ID'] = userId;

  const res = await fetch(`${WORKER_URL}/api/${endpoint}`, {
    method:  'POST',
    headers,
    body:    JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok || !data.ok) {
    throw new Error(data.error || `Worker error ${res.status}`);
  }
  return data;
}

// ── Main chat function ──────────────────────────────────────────────────────
// Returns either a plain text reply or a tool_call for client-side execution.

export async function chatWithAI(
  history: ChatMessage[],
  ctx: FinancialContext,
  onToolCall: (name: string, args: any) => Promise<string>,
  userId?: string,
): Promise<string> {
  const lastUserMsg = [...history].reverse().find(m => m.role === 'user')?.content || '';

  const data = await callWorker('chat', {
    query:    lastUserMsg,
    ctx,
    userId:   userId || '',
    messages: history.slice(0, -1), // send history excluding last user msg (sent as query)
  }, userId);

  // Worker returned a DB-write tool call → execute client-side
  if (data.tool_call) {
    const tc: ToolCall = data.tool_call;
    let toolResult: string;
    try {
      toolResult = await onToolCall(tc.name, tc.args);
    } catch (e: any) {
      toolResult = `Error executing ${tc.name}: ${e.message}`;
    }

    // Send tool result back for final AI response
    const finalData = await callWorker('chat', {
      query:    `[Tool result for ${tc.name}]: ${toolResult}. Now give the user a friendly confirmation.`,
      ctx,
      userId:   userId || '',
      messages: history,
    }, userId);

    return finalData.reply || `Done: ${toolResult}`;
  }

  return data.reply || "Sorry, I couldn't generate a response.";
}

// ── Statement parser ────────────────────────────────────────────────────────

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

// ── Settings API ────────────────────────────────────────────────────────────

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

// ── Logs API ────────────────────────────────────────────────────────────────

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

// ── Memory API ──────────────────────────────────────────────────────────────

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

// ── Health API ──────────────────────────────────────────────────────────────

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
