/**
 * FinFree MCP Server
 * Connects Claude, ChatGPT, and other AI tools to your FinFree financial data.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_ANON_KEY=... FINFREE_USER_ID=... node index.js
 *
 * Add to Claude Desktop config (~/.claude/claude_desktop_config.json):
 * {
 *   "mcpServers": {
 *     "finfree": {
 *       "command": "node",
 *       "args": ["/path/to/mcp-server/index.js"],
 *       "env": {
 *         "SUPABASE_URL": "your_url",
 *         "SUPABASE_ANON_KEY": "your_key",
 *         "FINFREE_USER_ID": "your_user_id"
 *       }
 *     }
 *   }
 * }
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_ANON_KEY || '';
const userId = process.env.FINFREE_USER_ID || '';

if (!supabaseUrl || !supabaseKey || !userId) {
  process.stderr.write('ERROR: Set SUPABASE_URL, SUPABASE_ANON_KEY, and FINFREE_USER_ID env vars\n');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const server = new Server(
  { name: 'finfree', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

// ── Tool definitions ──────────────────────────────────────────────────────────

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'financial_summary',
      description: 'Get a complete financial snapshot: net worth, accounts, monthly income/expenses, investments, EMIs, goals',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'list_transactions',
      description: 'List transactions with optional filters',
      inputSchema: {
        type: 'object',
        properties: {
          limit:    { type: 'number', description: 'Max results (default 50)' },
          type:     { type: 'string', enum: ['income', 'expense', 'transfer'], description: 'Filter by type' },
          category: { type: 'string', description: 'Filter by category (partial match)' },
          from_date: { type: 'string', description: 'Start date YYYY-MM-DD' },
          to_date:  { type: 'string', description: 'End date YYYY-MM-DD' },
        },
      },
    },
    {
      name: 'add_transaction',
      description: 'Record a new income or expense transaction',
      inputSchema: {
        type: 'object',
        required: ['type', 'amount', 'category', 'account_id', 'date'],
        properties: {
          type:       { type: 'string', enum: ['income', 'expense'] },
          amount:     { type: 'number' },
          category:   { type: 'string', description: 'E.g. "Food 🍕", "Salary 💼"' },
          account_id: { type: 'string' },
          date:       { type: 'string', description: 'YYYY-MM-DD' },
          note:       { type: 'string' },
        },
      },
    },
    {
      name: 'bulk_add_transactions',
      description: 'Add multiple transactions at once',
      inputSchema: {
        type: 'object',
        required: ['transactions'],
        properties: {
          transactions: {
            type: 'array',
            items: {
              type: 'object',
              required: ['type', 'amount', 'category', 'account_id', 'date'],
              properties: {
                type:       { type: 'string', enum: ['income', 'expense'] },
                amount:     { type: 'number' },
                category:   { type: 'string' },
                account_id: { type: 'string' },
                date:       { type: 'string' },
                note:       { type: 'string' },
              },
            },
          },
        },
      },
    },
    {
      name: 'delete_transaction',
      description: 'Delete a transaction by ID',
      inputSchema: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
    },
    {
      name: 'list_accounts',
      description: 'List all bank accounts with balances',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'list_investments',
      description: 'List all investments with current values',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'add_investment',
      description: 'Add a new investment',
      inputSchema: {
        type: 'object',
        required: ['name', 'type', 'invested_amount', 'current_value'],
        properties: {
          name:            { type: 'string' },
          type:            { type: 'string', description: 'E.g. Mutual Fund, Gold, Stock' },
          invested_amount: { type: 'number' },
          current_value:   { type: 'number' },
          return_percent:  { type: 'number' },
          quantity:        { type: 'number' },
        },
      },
    },
    {
      name: 'list_emis',
      description: 'List all active EMIs/loans',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'list_goals',
      description: 'List all financial goals with progress',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'add_goal',
      description: 'Create a new financial goal',
      inputSchema: {
        type: 'object',
        required: ['name', 'target_amount'],
        properties: {
          name:           { type: 'string' },
          target_amount:  { type: 'number' },
          current_amount: { type: 'number' },
          deadline:       { type: 'string', description: 'YYYY-MM-DD' },
        },
      },
    },
    {
      name: 'update_goal_progress',
      description: 'Update the current saved amount for a goal',
      inputSchema: {
        type: 'object',
        required: ['goal_id', 'current_amount'],
        properties: {
          goal_id:        { type: 'string' },
          current_amount: { type: 'number' },
        },
      },
    },
    {
      name: 'spending_breakdown',
      description: 'Get spending breakdown by category for a given month',
      inputSchema: {
        type: 'object',
        properties: {
          month: { type: 'string', description: 'YYYY-MM (defaults to current month)' },
        },
      },
    },
  ],
}));

// ── Tool handlers ─────────────────────────────────────────────────────────────

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args = {} } = req.params;

  try {
    switch (name) {

      case 'financial_summary': {
        const [profileRes, accsRes, txRes, invRes, emiRes, goalRes] = await Promise.all([
          supabase.from('profiles').select('*').eq('id', userId).single(),
          supabase.from('accounts').select('*').eq('user_id', userId),
          supabase.from('transactions').select('*').eq('user_id', userId),
          supabase.from('investments').select('*').eq('user_id', userId),
          supabase.from('emis').select('*').eq('user_id', userId),
          supabase.from('goals').select('*').eq('user_id', userId),
        ]);
        const profile = profileRes.data || {};
        const accounts = accsRes.data || [];
        const txs = txRes.data || [];
        const investments = invRes.data || [];
        const emis = emiRes.data || [];
        const goals = goalRes.data || [];

        const totalCash = accounts.reduce((s, a) => s + Number(a.balance), 0);
        const totalInvested = investments.reduce((s, i) => s + Number(i.current_value), 0);
        const netWorth = totalCash + totalInvested - Number(profile.family_debt || 0);

        const now = new Date();
        const monthStr = now.toISOString().slice(0, 7);
        const monthTxs = txs.filter(t => t.date?.startsWith(monthStr));
        const monthIncome = monthTxs.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
        const monthExpense = monthTxs.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);

        const summary = {
          profile: { name: profile.name, age: profile.age, monthly_salary: profile.monthly_salary, freedom_target: profile.freedom_target },
          net_worth: { total: netWorth, liquid_cash: totalCash, invested: totalInvested, family_debt: profile.family_debt },
          this_month: { income: monthIncome, expenses: monthExpense, saved: monthIncome - monthExpense },
          accounts: accounts.map(a => ({ id: a.id, name: a.name, type: a.type, balance: a.balance })),
          investments: investments.map(i => ({ name: i.name, type: i.type, invested: i.invested_amount, current_value: i.current_value, return_percent: i.return_percent })),
          emis: emis.map(e => ({ name: e.name, emi_amount: e.emi_amount, paid_months: e.paid_months, tenure_months: e.tenure_months })),
          goals: goals.map(g => ({ name: g.name, target: g.target_amount, saved: g.current_amount, progress_pct: g.target_amount > 0 ? Math.round((g.current_amount / g.target_amount) * 100) : 0 })),
        };

        return { content: [{ type: 'text', text: JSON.stringify(summary, null, 2) }] };
      }

      case 'list_transactions': {
        let query = supabase.from('transactions').select('*').eq('user_id', userId).order('date', { ascending: false });
        if (args.type) query = query.eq('type', args.type);
        if (args.from_date) query = query.gte('date', args.from_date);
        if (args.to_date) query = query.lte('date', args.to_date);
        query = query.limit(args.limit || 50);
        const { data, error } = await query;
        if (error) throw error;
        let results = data || [];
        if (args.category) {
          const q = String(args.category).toLowerCase();
          results = results.filter(t => t.category?.toLowerCase().includes(q));
        }
        return { content: [{ type: 'text', text: JSON.stringify(results, null, 2) }] };
      }

      case 'add_transaction': {
        const { data: acc } = await supabase.from('accounts').select('balance').eq('id', args.account_id).single();
        if (!acc) throw new Error('Account not found');
        const tx = { user_id: userId, type: args.type, amount: args.amount, category: args.category, account_id: args.account_id, date: args.date, note: args.note || '', is_recurring: false };
        const { data, error } = await supabase.from('transactions').insert([tx]).select().single();
        if (error) throw error;
        const delta = args.type === 'income' ? args.amount : -args.amount;
        await supabase.from('accounts').update({ balance: Number(acc.balance) + delta }).eq('id', args.account_id);
        return { content: [{ type: 'text', text: `Transaction added: ${JSON.stringify(data)}` }] };
      }

      case 'bulk_add_transactions': {
        const txs = (args.transactions || []).map((t) => ({ user_id: userId, is_recurring: false, note: '', ...t }));
        const { data, error } = await supabase.from('transactions').insert(txs).select();
        if (error) throw error;
        return { content: [{ type: 'text', text: `Added ${(data || []).length} transactions` }] };
      }

      case 'delete_transaction': {
        const { data: tx } = await supabase.from('transactions').select('*').eq('id', args.id).single();
        if (tx) {
          const delta = tx.type === 'income' ? -tx.amount : tx.amount;
          await supabase.from('accounts').update({ balance: supabase.rpc('increment', { x: delta }) }).eq('id', tx.account_id);
        }
        const { error } = await supabase.from('transactions').delete().eq('id', args.id).eq('user_id', userId);
        if (error) throw error;
        return { content: [{ type: 'text', text: 'Transaction deleted' }] };
      }

      case 'list_accounts': {
        const { data, error } = await supabase.from('accounts').select('*').eq('user_id', userId);
        if (error) throw error;
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
      }

      case 'list_investments': {
        const { data, error } = await supabase.from('investments').select('*').eq('user_id', userId);
        if (error) throw error;
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
      }

      case 'add_investment': {
        const inv = { user_id: userId, return_percent: 0, quantity: null, ...args };
        const { data, error } = await supabase.from('investments').insert([inv]).select().single();
        if (error) throw error;
        return { content: [{ type: 'text', text: `Investment added: ${JSON.stringify(data)}` }] };
      }

      case 'list_emis': {
        const { data, error } = await supabase.from('emis').select('*').eq('user_id', userId);
        if (error) throw error;
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
      }

      case 'list_goals': {
        const { data, error } = await supabase.from('goals').select('*').eq('user_id', userId);
        if (error) throw error;
        const withProgress = (data || []).map(g => ({
          ...g,
          progress_pct: g.target_amount > 0 ? Math.round((g.current_amount / g.target_amount) * 100) : 0,
        }));
        return { content: [{ type: 'text', text: JSON.stringify(withProgress, null, 2) }] };
      }

      case 'add_goal': {
        const goal = { user_id: userId, current_amount: 0, deadline: null, ...args };
        const { data, error } = await supabase.from('goals').insert([goal]).select().single();
        if (error) throw error;
        return { content: [{ type: 'text', text: `Goal created: ${JSON.stringify(data)}` }] };
      }

      case 'update_goal_progress': {
        const { error } = await supabase.from('goals').update({ current_amount: args.current_amount }).eq('id', args.goal_id).eq('user_id', userId);
        if (error) throw error;
        return { content: [{ type: 'text', text: `Goal ${args.goal_id} updated to ₹${args.current_amount}` }] };
      }

      case 'spending_breakdown': {
        const month = args.month || new Date().toISOString().slice(0, 7);
        const { data, error } = await supabase.from('transactions').select('category, amount, type').eq('user_id', userId).eq('type', 'expense').like('date', `${month}%`);
        if (error) throw error;
        const breakdown = {};
        for (const tx of data || []) {
          breakdown[tx.category] = (breakdown[tx.category] || 0) + Number(tx.amount);
        }
        const sorted = Object.entries(breakdown).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => ({ category: cat, amount: amt }));
        return { content: [{ type: 'text', text: JSON.stringify({ month, breakdown: sorted, total: sorted.reduce((s, r) => s + r.amount, 0) }, null, 2) }] };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (err) {
    return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
  }
});

// ── Start ─────────────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
process.stderr.write('FinFree MCP server running\n');
