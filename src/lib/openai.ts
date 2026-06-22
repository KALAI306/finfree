import type { Profile, Account, Transaction, Investment, EMI, Goal } from "./db";

const API_KEY  = import.meta.env.VITE_GEMINI_API_KEY as string;
const MODEL    = "gemini-2.0-flash";
const BASE_URL = import.meta.env.DEV
  ? `/api/gemini/v1beta/models/${MODEL}`
  : `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}`;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
  name?: string;
}

export interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export interface FinancialContext {
  profile: Profile | null;
  accounts: Account[];
  transactions: Transaction[];
  investments: Investment[];
  emis: EMI[];
  goals: Goal[];
}

// ─── System prompt ────────────────────────────────────────────────────────────

export function buildSystemPrompt(ctx: FinancialContext): string {
  const p   = ctx.profile;
  const now = new Date();
  const cm  = now.getMonth();
  const cy  = now.getFullYear();

  const monthTxs  = ctx.transactions.filter(t => { const d = new Date(t.date); return d.getMonth() === cm && d.getFullYear() === cy; });
  const monthInc  = monthTxs.filter(t => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
  const monthExp  = monthTxs.filter(t => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
  const totBal    = ctx.accounts.reduce((s, a) => s + Number(a.balance), 0);
  const totEmi    = ctx.emis.reduce((s, e) => s + Number(e.emi_amount), 0);
  const salary    = p ? Number(p.monthly_salary) : 0;

  return `You are FinFree AI — a sharp, friendly personal finance assistant built into the FinFree app (India-focused).

## User's Financial Snapshot
- Name: ${p?.name || "User"} | Age: ${p?.age || "?"}
- Monthly Salary: ₹${salary.toLocaleString("en-IN")}
- Family Debt: ₹${Number(p?.family_debt || 0).toLocaleString("en-IN")}
- Freedom Target: ₹${Number(p?.freedom_target || 0).toLocaleString("en-IN")} by age ${p?.target_freedom_age || "?"}

## This Month (${now.toLocaleString("en-IN", { month: "long", year: "numeric" })})
- Income: ₹${monthInc.toLocaleString("en-IN")} | Expenses: ₹${monthExp.toLocaleString("en-IN")} | Saved: ₹${(monthInc - monthExp).toLocaleString("en-IN")}

## Accounts (₹${totBal.toLocaleString("en-IN")} total)
${ctx.accounts.map(a => `- ${a.name} [${a.id}]: ₹${Number(a.balance).toLocaleString("en-IN")}`).join("\n") || "None"}

## EMIs — ₹${totEmi.toLocaleString("en-IN")}/mo (${salary > 0 ? ((totEmi / salary) * 100).toFixed(1) : 0}% of salary)
${ctx.emis.map(e => `- ${e.name}: ₹${Number(e.emi_amount).toLocaleString("en-IN")}/mo`).join("\n") || "None"}

## Goals
${ctx.goals.map(g => `- ${g.name} [${g.id}]: ₹${Number(g.current_amount).toLocaleString("en-IN")} / ₹${Number(g.target_amount).toLocaleString("en-IN")}`).join("\n") || "None"}

## Recent Transactions (last 20)
${ctx.transactions.slice(0, 20).map(t => `- ${t.date} | ${t.type === "income" ? "+" : "-"}₹${Number(t.amount).toLocaleString("en-IN")} | ${t.category} | ${t.note}`).join("\n") || "None"}

## Rules
- Always use real numbers from the snapshot. Never make up figures.
- Be concise, direct, Indian-context-aware (₹, lakhs, crores).
- When adding/creating/updating something, use the available tools.
- Confirm clearly when an action is done.`;
}

// ─── Tool definitions (Gemini native format) ──────────────────────────────────

const FUNCTION_DECLARATIONS = [
  {
    name: "add_transaction",
    description: "Add a new income or expense transaction for the user",
    parameters: {
      type: "OBJECT",
      properties: {
        account_id: { type: "STRING", description: "Account ID to use. Use the first account if unsure." },
        type:       { type: "STRING", enum: ["income", "expense"] },
        amount:     { type: "NUMBER", description: "Amount in rupees" },
        category:   { type: "STRING", description: "e.g. Food 🍕, Salary 💼, Fuel ⛽, Shopping 🛍️, Healthcare 🏥, Miscellaneous 🎯" },
        note:       { type: "STRING", description: "Short description" },
        date:       { type: "STRING", description: "YYYY-MM-DD. Use today if not specified." },
      },
      required: ["account_id", "type", "amount", "category", "note", "date"],
    },
  },
  {
    name: "add_goal",
    description: "Create a new savings goal",
    parameters: {
      type: "OBJECT",
      properties: {
        name:           { type: "STRING" },
        target_amount:  { type: "NUMBER" },
        current_amount: { type: "NUMBER" },
        deadline:       { type: "STRING", description: "YYYY-MM-DD (optional)" },
      },
      required: ["name", "target_amount"],
    },
  },
  {
    name: "update_goal_progress",
    description: "Add money to an existing savings goal",
    parameters: {
      type: "OBJECT",
      properties: {
        goal_id:    { type: "STRING" },
        add_amount: { type: "NUMBER" },
      },
      required: ["goal_id", "add_amount"],
    },
  },
  {
    name: "get_spending_breakdown",
    description: "Get spending breakdown by category for a month",
    parameters: {
      type: "OBJECT",
      properties: {
        month: { type: "NUMBER", description: "1-12, defaults to current" },
        year:  { type: "NUMBER", description: "e.g. 2026" },
      },
      required: [],
    },
  },
];

// ─── Gemini message converters ────────────────────────────────────────────────

function toGeminiContents(messages: ChatMessage[]): any[] {
  const contents: any[] = [];

  for (const msg of messages) {
    if (msg.role === "system") continue; // handled via systemInstruction

    if (msg.role === "user") {
      contents.push({ role: "user", parts: [{ text: msg.content || "" }] });

    } else if (msg.role === "assistant") {
      const parts: any[] = [];
      if (msg.content) parts.push({ text: msg.content });
      if (msg.tool_calls?.length) {
        msg.tool_calls.forEach(tc => parts.push({
          functionCall: { name: tc.function.name, args: JSON.parse(tc.function.arguments) }
        }));
      }
      contents.push({ role: "model", parts: parts.length ? parts : [{ text: "" }] });

    } else if (msg.role === "tool") {
      contents.push({
        role: "user",
        parts: [{ functionResponse: { name: msg.name || "", response: { content: msg.content || "" } } }],
      });
    }
  }

  return contents;
}

// ─── Core API call ────────────────────────────────────────────────────────────

async function callGemini(
  messages: ChatMessage[],
  useTools = true,
  retries = 2
): Promise<{ content: string | null; tool_calls?: ToolCall[] }> {
  const systemMsg = messages.find(m => m.role === "system");
  const rest      = messages.filter(m => m.role !== "system");

  const body: any = {
    contents: toGeminiContents(rest),
    generationConfig: { maxOutputTokens: 1024, temperature: 0.7 },
  };
  if (systemMsg?.content) {
    body.systemInstruction = { parts: [{ text: systemMsg.content }] };
  }
  if (useTools) {
    body.tools      = [{ functionDeclarations: FUNCTION_DECLARATIONS }];
    body.toolConfig = { functionCallingConfig: { mode: "AUTO" } };
  }

  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(`${BASE_URL}:generateContent?key=${API_KEY}`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(body),
    });

    if (res.status === 429) {
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 4000 * (attempt + 1)));
        continue;
      }
      const err = await res.text();
      throw new Error(`429: ${err}`);
    }

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Gemini ${res.status}: ${err}`);
    }

    const data      = await res.json();
    const parts     = data.candidates?.[0]?.content?.parts ?? [];
    let text        = "";
    const toolCalls: ToolCall[] = [];

    for (const part of parts) {
      if (part.text) text += part.text;
      if (part.functionCall) {
        toolCalls.push({
          id:   `call_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          type: "function",
          function: { name: part.functionCall.name, arguments: JSON.stringify(part.functionCall.args) },
        });
      }
    }

    return { content: text || null, tool_calls: toolCalls.length ? toolCalls : undefined };
  }

  throw new Error("Max retries exceeded");
}

// ─── Spending breakdown (local) ───────────────────────────────────────────────

export function computeSpendingBreakdown(transactions: Transaction[], month?: number, year?: number): string {
  const now = new Date();
  const m   = (month ?? now.getMonth() + 1) - 1;
  const y   = year ?? now.getFullYear();

  const filtered = transactions.filter(t => {
    const d = new Date(t.date);
    return t.type === "expense" && d.getMonth() === m && d.getFullYear() === y;
  });

  const breakdown: Record<string, number> = {};
  for (const t of filtered) {
    const cat = t.category.replace(/[^\x00-\x7F]/g, "").trim() || "Other";
    breakdown[cat] = (breakdown[cat] || 0) + Number(t.amount);
  }

  const total  = Object.values(breakdown).reduce((s, v) => s + v, 0);
  const sorted = Object.entries(breakdown).sort((a, b) => b[1] - a[1]);
  if (!sorted.length) return "No expenses recorded for that period.";

  return `Spending breakdown:\nTotal: ₹${total.toLocaleString("en-IN")}\n` +
    sorted.map(([c, a]) => `- ${c}: ₹${a.toLocaleString("en-IN")} (${((a / total) * 100).toFixed(1)}%)`).join("\n");
}

// ─── Main chat loop ───────────────────────────────────────────────────────────

export async function chatWithAI(
  history: ChatMessage[],
  ctx: FinancialContext,
  onToolCall: (name: string, args: any) => Promise<string>
): Promise<string> {
  const systemMsg: ChatMessage = { role: "system", content: buildSystemPrompt(ctx) };
  const messages: ChatMessage[] = [systemMsg, ...history];

  let result = await callGemini(messages);

  for (let round = 0; round < 3 && result.tool_calls?.length; round++) {
    const assistantMsg: ChatMessage = {
      role: "assistant", content: result.content, tool_calls: result.tool_calls,
    };
    messages.push(assistantMsg);

    for (const tc of result.tool_calls) {
      let toolResult: string;
      try {
        const args = JSON.parse(tc.function.arguments);
        toolResult = tc.function.name === "get_spending_breakdown"
          ? computeSpendingBreakdown(ctx.transactions, args.month, args.year)
          : await onToolCall(tc.function.name, args);
      } catch (e: any) {
        toolResult = `Error: ${e.message}`;
      }
      messages.push({ role: "tool", tool_call_id: tc.id, content: toolResult, name: tc.function.name });
    }

    result = await callGemini(messages, false);
  }

  return result.content || "Sorry, I couldn't generate a response.";
}

// ─── PDF / Statement parser ───────────────────────────────────────────────────

export interface ParsedAITransaction {
  date: string;
  amount: number;
  type: "income" | "expense";
  note: string;
  category: string;
}

export async function parseStatementWithAI(statementText: string): Promise<ParsedAITransaction[]> {
  const prompt = `You are a bank statement parser for Indian banks. Extract ALL transactions from the text below and return ONLY a valid JSON array. Each object must have:
- date: "YYYY-MM-DD"
- amount: number (positive)
- type: "income" or "expense" (credit = income, debit = expense)
- note: short description
- category: one of ["Salary 💼","Food 🍕","Fuel ⛽","Rent/PG 🏠","Healthcare 🏥","Shopping 🛍️","Recharges 📱","Gold Investment 🥇","Daily Workers 👷","EMI 💳","Transfer 💸","Cash Withdrawal 💸","Other Income 🎁","Miscellaneous 🎯"]

Rules: UPI credits/NEFT/salary = income. UPI debits/withdrawals/purchases = expense. If year missing use 2026. Return [] if none found. Return ONLY the JSON array, no explanation.

Bank statement:
${statementText.slice(0, 8000)}`;

  const messages: ChatMessage[] = [{ role: "user", content: prompt }];
  const result = await callGemini(messages, false);
  const text   = result.content || "[]";

  try {
    const match = text.match(/\[[\s\S]*\]/);
    return match ? JSON.parse(match[0]) : [];
  } catch {
    return [];
  }
}
