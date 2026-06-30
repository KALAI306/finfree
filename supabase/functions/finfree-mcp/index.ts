import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const INVESTMENT_TYPES = ['mutual_fund', 'stock', 'gold', 'silver'] as const;
const ACCOUNT_TYPES = ['savings', 'current', 'cash', 'wallet', 'fd', 'ppf', 'nps', 'crypto', 'other'];

const TOOLS = [
  // ── READ ──────────────────────────────────────────────────────────────────────
  {
    name: 'financial_summary',
    description: "Get a complete financial snapshot: net worth, accounts, monthly income/expenses, investments, EMIs, goals. Use this first to understand the user's financial picture before any other query.",
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'get_investment_types',
    description: 'Returns the list of valid investment type values. Always call this before add_investment or update_investment to use the correct type string.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'list_transactions',
    description: 'List transactions with optional filters. Returns up to 100 results sorted by date descending. Filter by account using account_id or account_name.',
    inputSchema: {
      type: 'object',
      properties: {
        limit:        { type: 'number', description: 'Max results (default 50, max 100)' },
        type:         { type: 'string', enum: ['income', 'expense', 'transfer'], description: 'Filter by transaction type' },
        category:     { type: 'string', description: 'Partial match on category name' },
        from_date:    { type: 'string', description: 'Start date inclusive, format YYYY-MM-DD' },
        to_date:      { type: 'string', description: 'End date inclusive, format YYYY-MM-DD' },
        keyword:      { type: 'string', description: 'Partial match on note or category' },
        account_id:   { type: 'string', description: 'Filter to one account by UUID' },
        account_name: { type: 'string', description: 'Filter to one account by name (case-insensitive, use instead of account_id)' },
      },
    },
  },
  {
    name: 'get_account_statement',
    description: 'Get all transactions for a specific account, optionally filtered by date range. Useful for generating mini bank statements.',
    inputSchema: {
      type: 'object',
      required: ['account_id'],
      properties: {
        account_id: { type: 'string', description: 'UUID of the account' },
        from_date:  { type: 'string', description: 'Start date YYYY-MM-DD' },
        to_date:    { type: 'string', description: 'End date YYYY-MM-DD' },
        limit:      { type: 'number', description: 'Max results (default 100)' },
      },
    },
  },
  {
    name: 'spending_breakdown',
    description: 'Get expense totals grouped by category for a given month. Defaults to the current month.',
    inputSchema: {
      type: 'object',
      properties: {
        month: { type: 'string', description: 'Format YYYY-MM. Defaults to current month.' },
      },
    },
  },
  {
    name: 'list_accounts',
    description: 'List all bank/cash accounts with their current balances and types.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'list_investments',
    description: 'List all investments with invested amount, current value, and return percentage.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'list_goals',
    description: 'List all financial goals with progress percentage and deadline.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'list_emis',
    description: 'List all active EMIs/loans with principal, interest rate, monthly EMI, tenure, and paid months.',
    inputSchema: { type: 'object', properties: {} },
  },
  // ── TRANSACTIONS ──────────────────────────────────────────────────────────────
  {
    name: 'add_transaction',
    description: 'Record a single income or expense transaction. Provide either account_id (from list_accounts) or account_name (matched case-insensitively) — account_name is easier when you don\'t already have the UUID.',
    inputSchema: {
      type: 'object',
      required: ['type', 'amount', 'category', 'date'],
      properties: {
        type:         { type: 'string', enum: ['income', 'expense'], description: 'income or expense' },
        amount:       { type: 'number', description: 'Positive number' },
        category:     { type: 'string', description: 'E.g. "Food 🍕", "Salary 💼", "Fuel ⛽"' },
        account_id:   { type: 'string', description: 'UUID from list_accounts (use this OR account_name)' },
        account_name: { type: 'string', description: 'Account name, case-insensitive match (use this OR account_id)' },
        date:         { type: 'string', description: 'YYYY-MM-DD' },
        note:         { type: 'string', description: 'Optional note or description' },
      },
    },
  },
  {
    name: 'bulk_add_transactions',
    description: 'Add multiple transactions at once. Set a top-level account_id/account_name to apply to all of them, or set it per-transaction to mix accounts. Account balances are updated for every transaction added.',
    inputSchema: {
      type: 'object',
      required: ['transactions'],
      properties: {
        account_id:   { type: 'string', description: 'Default account UUID applied to any transaction that omits one' },
        account_name: { type: 'string', description: 'Default account name applied to any transaction that omits one' },
        transactions: {
          type: 'array',
          description: 'Array of transactions to add',
          items: {
            type: 'object',
            required: ['type', 'amount', 'category', 'date'],
            properties: {
              type:         { type: 'string', enum: ['income', 'expense'] },
              amount:       { type: 'number' },
              category:     { type: 'string' },
              account_id:   { type: 'string', description: 'Overrides the top-level account for this row' },
              account_name: { type: 'string', description: 'Overrides the top-level account for this row' },
              date:         { type: 'string', description: 'YYYY-MM-DD' },
              note:         { type: 'string' },
            },
          },
        },
      },
    },
  },
  {
    name: 'update_transaction',
    description: 'Edit an existing transaction by its ID. Only the fields you provide will be updated; others stay unchanged.',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: {
        id:       { type: 'string', description: 'Transaction UUID from list_transactions' },
        amount:   { type: 'number', description: 'New amount (positive number)' },
        category: { type: 'string', description: 'New category string' },
        note:     { type: 'string', description: 'New note/description' },
        date:     { type: 'string', description: 'New date YYYY-MM-DD' },
        type:     { type: 'string', enum: ['income', 'expense'], description: 'New transaction type' },
      },
    },
  },
  {
    name: 'delete_transaction',
    description: 'Delete a single transaction by ID and reverse its effect on the linked account balance.',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'string', description: 'Transaction UUID from list_transactions' },
      },
    },
  },
  {
    name: 'bulk_delete_transactions',
    description: 'Delete multiple transactions at once matching a filter. At least one filter must be provided.',
    inputSchema: {
      type: 'object',
      properties: {
        ids:        { type: 'array', items: { type: 'string' }, description: 'Specific transaction UUIDs to delete' },
        account_id: { type: 'string', description: 'Delete all transactions for this account' },
        type:       { type: 'string', enum: ['income', 'expense', 'transfer'], description: 'Delete by type' },
        from_date:  { type: 'string', description: 'Delete from this date YYYY-MM-DD' },
        to_date:    { type: 'string', description: 'Delete until this date YYYY-MM-DD' },
        category:   { type: 'string', description: 'Delete matching this category (exact)' },
      },
    },
  },
  // ── ACCOUNTS ──────────────────────────────────────────────────────────────────
  {
    name: 'create_account',
    description: `Create a new bank/cash account. Common types: ${ACCOUNT_TYPES.join(', ')}. Custom type strings are also accepted (no DB constraint).`,
    inputSchema: {
      type: 'object',
      required: ['name', 'type'],
      properties: {
        name:            { type: 'string', description: 'Account name, e.g. "SBI Savings", "Cash Wallet"' },
        type:            { type: 'string', description: `Account type. Common values: ${ACCOUNT_TYPES.join(', ')}` },
        initial_balance: { type: 'number', description: 'Opening balance (default 0)' },
      },
    },
  },
  {
    name: 'update_account',
    description: "Update an account's name or type by ID. Balance is NOT editable here — it is auto-calculated from transactions. To change the opening balance, use update_account with a new initial reference point isn't supported; adjust via a transaction instead.",
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: {
        id:   { type: 'string', description: 'Account UUID from list_accounts' },
        name: { type: 'string', description: 'New account name' },
        type: { type: 'string', description: 'New account type' },
      },
    },
  },
  {
    name: 'delete_account',
    description: 'Delete an account by ID. WARNING: This does not delete linked transactions — use bulk_delete_transactions first if you want a clean removal.',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'string', description: 'Account UUID from list_accounts' },
      },
    },
  },
  // ── INVESTMENTS ───────────────────────────────────────────────────────────────
  {
    name: 'add_investment',
    description: `Add a new investment holding. Call get_investment_types first to confirm valid type values. Built-in types (lowercase): ${INVESTMENT_TYPES.join(', ')}. Custom type strings are also accepted.`,
    inputSchema: {
      type: 'object',
      required: ['name', 'type', 'invested_amount', 'current_value'],
      properties: {
        name:            { type: 'string', description: 'Investment name, e.g. "Groww Nifty 50"' },
        type:            { type: 'string', enum: [...INVESTMENT_TYPES], description: `Investment type, lowercase. One of: ${INVESTMENT_TYPES.join(', ')}. Use a custom string if none fit.` },
        invested_amount: { type: 'number', description: 'Total amount invested (cost basis)' },
        current_value:   { type: 'number', description: 'Current market value' },
        quantity:        { type: 'number', description: 'Number of units/shares (optional)' },
        return_percent:  { type: 'number', description: 'Return percentage, auto-calculated if omitted' },
      },
    },
  },
  {
    name: 'update_investment',
    description: 'Update an existing investment by ID. Only provided fields are changed. Return % is auto-calculated if invested_amount and current_value are both updated.',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: {
        id:              { type: 'string', description: 'Investment UUID from list_investments' },
        name:            { type: 'string', description: 'New investment name' },
        type:            { type: 'string', enum: [...INVESTMENT_TYPES], description: `New type, lowercase. One of: ${INVESTMENT_TYPES.join(', ')}` },
        invested_amount: { type: 'number', description: 'New cost basis amount' },
        current_value:   { type: 'number', description: 'New current market value' },
        quantity:        { type: 'number', description: 'New quantity/units' },
        return_percent:  { type: 'number', description: 'New return %, or omit to auto-calculate' },
      },
    },
  },
  {
    name: 'delete_investment',
    description: 'Delete an investment by ID. This action is irreversible.',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'string', description: 'Investment UUID from list_investments' },
      },
    },
  },
  // ── GOALS ─────────────────────────────────────────────────────────────────────
  {
    name: 'add_goal',
    description: 'Create a new financial savings goal.',
    inputSchema: {
      type: 'object',
      required: ['name', 'target_amount'],
      properties: {
        name:           { type: 'string', description: 'Goal name, e.g. "Emergency Fund", "Vacation"' },
        target_amount:  { type: 'number', description: 'Target amount to save' },
        current_amount: { type: 'number', description: 'Already saved amount (default 0)' },
        deadline:       { type: 'string', description: 'Target completion date YYYY-MM-DD (optional)' },
      },
    },
  },
  {
    name: 'update_goal',
    description: "Update a goal's name, target amount, saved amount, or deadline by ID.",
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: {
        id:             { type: 'string', description: 'Goal UUID from list_goals' },
        name:           { type: 'string', description: 'New goal name' },
        target_amount:  { type: 'number', description: 'New target amount' },
        current_amount: { type: 'number', description: 'New saved amount' },
        deadline:       { type: 'string', description: 'New deadline YYYY-MM-DD, or null to remove' },
      },
    },
  },
  {
    name: 'update_goal_progress',
    description: 'Shortcut to update only the current saved amount for a goal.',
    inputSchema: {
      type: 'object',
      required: ['goal_id', 'current_amount'],
      properties: {
        goal_id:        { type: 'string', description: 'Goal UUID' },
        current_amount: { type: 'number', description: 'New saved amount' },
      },
    },
  },
  {
    name: 'delete_goal',
    description: 'Delete a financial goal by ID. This action is irreversible.',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'string', description: 'Goal UUID from list_goals' },
      },
    },
  },
  // ── EMIs ──────────────────────────────────────────────────────────────────────
  {
    name: 'add_emi',
    description: 'Create a new EMI/loan entry. DB column for total loan amount is "principal" (not total_amount).',
    inputSchema: {
      type: 'object',
      required: ['name', 'principal', 'interest_rate', 'tenure_months', 'emi_amount', 'start_date'],
      properties: {
        name:          { type: 'string', description: 'Loan/EMI name, e.g. "Home Loan - HDFC"' },
        principal:     { type: 'number', description: 'Total loan principal amount' },
        interest_rate: { type: 'number', description: 'Annual interest rate in percent, e.g. 8.5' },
        tenure_months: { type: 'number', description: 'Total loan tenure in months' },
        emi_amount:    { type: 'number', description: 'Monthly EMI amount' },
        start_date:    { type: 'string', description: 'Loan start date YYYY-MM-DD' },
        paid_months:   { type: 'number', description: 'Number of EMIs already paid (default 0)' },
      },
    },
  },
  {
    name: 'update_emi',
    description: 'Update an EMI/loan entry by ID. Only provided fields are changed. DB column for total loan amount is "principal" (not total_amount).',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: {
        id:            { type: 'string', description: 'EMI UUID from list_emis' },
        name:          { type: 'string', description: 'Loan/EMI name, e.g. "Home Loan - HDFC"' },
        principal:     { type: 'number', description: 'Total loan principal amount' },
        interest_rate: { type: 'number', description: 'Annual interest rate in percent, e.g. 8.5' },
        emi_amount:    { type: 'number', description: 'Monthly EMI amount' },
        tenure_months: { type: 'number', description: 'Total loan tenure in months' },
        paid_months:   { type: 'number', description: 'Number of EMIs already paid' },
        start_date:    { type: 'string', description: 'Loan start date YYYY-MM-DD' },
      },
    },
  },
  {
    name: 'delete_emi',
    description: 'Delete an EMI/loan entry by ID. This action is irreversible.',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'string', description: 'EMI UUID from list_emis' },
      },
    },
  },
  // ── RESET ─────────────────────────────────────────────────────────────────────
  {
    name: 'reset_all_data',
    description: 'DANGER: Permanently deletes ALL transactions, investments, goals, and EMIs. Accounts are kept. Requires confirm=true. Without it, returns a dry-run count of what would be deleted.',
    inputSchema: {
      type: 'object',
      required: ['confirm'],
      properties: {
        confirm: { type: 'boolean', description: 'Must be true to execute. False returns a dry-run summary.' },
      },
    },
  },
];

async function getUserFromToken(token: string, supabase: ReturnType<typeof createClient>) {
  const { data, error } = await supabase.from('mcp_tokens').select('user_id').eq('token', token).single();
  if (error || !data) return null;
  await supabase.from('mcp_tokens').update({ last_used_at: new Date().toISOString() }).eq('token', token);
  return data.user_id as string;
}

async function resolveAccountId(args: Record<string, unknown>, userId: string, supabase: ReturnType<typeof createClient>): Promise<string> {
  if (args.account_id) return args.account_id as string;
  if (args.account_name) {
    const { data, error } = await supabase.from('accounts').select('id,name').eq('user_id', userId);
    if (error) throw error;
    const q = String(args.account_name).toLowerCase();
    const rows = (data || []) as { id: string; name: string }[];
    const match = rows.find(a => a.name.toLowerCase() === q) || rows.find(a => a.name.toLowerCase().includes(q));
    if (!match) throw new Error(`No account found matching "${args.account_name}". Use list_accounts to see valid names.`);
    return match.id;
  }
  throw new Error('Provide either account_id or account_name.');
}

async function adjustAccountBalance(accountId: string, delta: number, supabase: ReturnType<typeof createClient>) {
  const { data: acc } = await supabase.from('accounts').select('balance').eq('id', accountId).single();
  if (acc) await supabase.from('accounts').update({ balance: Number((acc as any).balance) + delta }).eq('id', accountId);
}

async function handleTool(name: string, args: Record<string, unknown>, userId: string, supabase: ReturnType<typeof createClient>): Promise<unknown> {
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
      const profile = (profileRes.data || {}) as Record<string, unknown>;
      const accounts = accsRes.data || [];
      const txs = txRes.data || [];
      const investments = invRes.data || [];
      const emis = emiRes.data || [];
      const goals = goalRes.data || [];
      const totalCash = accounts.reduce((s: number, a: any) => s + Number(a.balance), 0);
      const totalInvested = investments.reduce((s: number, i: any) => s + Number(i.current_value), 0);
      const netWorth = totalCash + totalInvested - Number(profile.family_debt || 0);
      const monthStr = new Date().toISOString().slice(0, 7);
      const monthTxs = txs.filter((t: any) => t.date?.startsWith(monthStr));
      const monthIncome = monthTxs.filter((t: any) => t.type === 'income').reduce((s: number, t: any) => s + Number(t.amount), 0);
      const monthExpense = monthTxs.filter((t: any) => t.type === 'expense').reduce((s: number, t: any) => s + Number(t.amount), 0);
      return {
        profile: { name: profile.name, age: profile.age, monthly_salary: profile.monthly_salary, freedom_target: profile.freedom_target },
        net_worth: { total: netWorth, liquid_cash: totalCash, invested: totalInvested, family_debt: profile.family_debt },
        this_month: { income: monthIncome, expenses: monthExpense, saved: monthIncome - monthExpense, savings_rate_pct: monthIncome > 0 ? Math.round(((monthIncome - monthExpense) / monthIncome) * 100) : null },
        accounts: accounts.map((a: any) => ({ id: a.id, name: a.name, type: a.type, balance: a.balance })),
        investments: investments.map((i: any) => ({ id: i.id, name: i.name, type: i.type, invested: i.invested_amount, current_value: i.current_value, return_percent: i.return_percent })),
        emis: emis.map((e: any) => ({ id: e.id, name: e.name, emi_amount: e.emi_amount, principal: e.principal, paid_months: e.paid_months, tenure_months: e.tenure_months })),
        goals: goals.map((g: any) => ({ id: g.id, name: g.name, target: g.target_amount, saved: g.current_amount, progress_pct: g.target_amount > 0 ? Math.round((g.current_amount / g.target_amount) * 100) : 0, deadline: g.deadline })),
      };
    }

    case 'get_investment_types':
      return { builtin_types: [...INVESTMENT_TYPES], note: 'Custom types are also accepted.', examples: { mutual_fund: 'Groww Nifty 50, HDFC ELSS', stock: 'Reliance, TCS', gold: 'SGB, Gold ETF', silver: 'Silver coins' } };

    case 'list_transactions': {
      let query = supabase.from('transactions').select('*').eq('user_id', userId).order('date', { ascending: false });
      if (args.type) query = query.eq('type', args.type as string);
      if (args.from_date) query = query.gte('date', args.from_date as string);
      if (args.to_date) query = query.lte('date', args.to_date as string);
      if (args.account_id) {
        query = query.eq('account_id', args.account_id as string);
      } else if (args.account_name) {
        const accId = await resolveAccountId(args, userId, supabase);
        query = query.eq('account_id', accId);
      }
      query = query.limit(Math.min((args.limit as number) || 50, 100));
      const { data, error } = await query;
      if (error) throw error;
      let results = data || [];
      const kw = (args.keyword || args.category) as string | undefined;
      if (kw) { const q = kw.toLowerCase(); results = results.filter((t: any) => t.category?.toLowerCase().includes(q) || t.note?.toLowerCase().includes(q)); }
      return results;
    }

    case 'get_account_statement': {
      let query = supabase.from('transactions').select('*').eq('user_id', userId).eq('account_id', args.account_id as string).order('date', { ascending: false });
      if (args.from_date) query = query.gte('date', args.from_date as string);
      if (args.to_date) query = query.lte('date', args.to_date as string);
      query = query.limit((args.limit as number) || 100);
      const { data, error } = await query;
      if (error) throw error;
      const txs = data || [];
      const totalIn = txs.filter((t: any) => t.type === 'income').reduce((s: number, t: any) => s + Number(t.amount), 0);
      const totalOut = txs.filter((t: any) => t.type === 'expense').reduce((s: number, t: any) => s + Number(t.amount), 0);
      return { account_id: args.account_id, transaction_count: txs.length, total_income: totalIn, total_expense: totalOut, net: totalIn - totalOut, transactions: txs };
    }

    case 'spending_breakdown': {
      const month = (args.month as string) || new Date().toISOString().slice(0, 7);
      const { data, error } = await supabase.from('transactions').select('category,amount').eq('user_id', userId).eq('type', 'expense').like('date', `${month}%`);
      if (error) throw error;
      const bd: Record<string, number> = {};
      for (const tx of data || []) bd[tx.category] = (bd[tx.category] || 0) + Number(tx.amount);
      const sorted = Object.entries(bd).sort((a, b) => b[1] - a[1]).map(([category, amount]) => ({ category, amount }));
      return { month, breakdown: sorted, total: sorted.reduce((s, r) => s + r.amount, 0) };
    }

    case 'list_accounts': { const { data, error } = await supabase.from('accounts').select('*').eq('user_id', userId); if (error) throw error; return data; }
    case 'list_investments': { const { data, error } = await supabase.from('investments').select('*').eq('user_id', userId); if (error) throw error; return data; }
    case 'list_goals': { const { data, error } = await supabase.from('goals').select('*').eq('user_id', userId); if (error) throw error; return (data || []).map((g: any) => ({ ...g, progress_pct: g.target_amount > 0 ? Math.round((g.current_amount / g.target_amount) * 100) : 0 })); }
    case 'list_emis': { const { data, error } = await supabase.from('emis').select('*').eq('user_id', userId); if (error) throw error; return data; }

    case 'add_transaction': {
      const accountId = await resolveAccountId(args, userId, supabase);
      const { data: acc } = await supabase.from('accounts').select('balance').eq('id', accountId).single();
      if (!acc) throw new Error('Account not found.');
      const { data, error } = await supabase.from('transactions').insert([{ user_id: userId, type: args.type, amount: args.amount, category: args.category, account_id: accountId, date: args.date, note: args.note || '', is_recurring: false }]).select().single();
      if (error) throw error;
      const delta = args.type === 'income' ? Number(args.amount) : -Number(args.amount);
      await adjustAccountBalance(accountId, delta, supabase);
      return { success: true, transaction: data };
    }

    case 'bulk_add_transactions': {
      const hasDefault = args.account_id || args.account_name;
      const defaultAccountId = hasDefault ? await resolveAccountId(args, userId, supabase) : null;
      const rows: any[] = [];
      for (const t of (args.transactions as any[]) || []) {
        const accId = (t.account_id || t.account_name) ? await resolveAccountId(t, userId, supabase) : defaultAccountId;
        if (!accId) throw new Error('Each transaction needs account_id/account_name, or set one at the top level.');
        rows.push({ user_id: userId, is_recurring: false, note: t.note || '', type: t.type, amount: t.amount, category: t.category, date: t.date, account_id: accId });
      }
      const { data, error } = await supabase.from('transactions').insert(rows).select();
      if (error) throw error;
      const byAccount: Record<string, number> = {};
      for (const r of rows) byAccount[r.account_id] = (byAccount[r.account_id] || 0) + (r.type === 'income' ? Number(r.amount) : -Number(r.amount));
      for (const [accId, delta] of Object.entries(byAccount)) await adjustAccountBalance(accId, delta, supabase);
      return { success: true, added: (data || []).length };
    }

    case 'update_transaction': {
      const updates: Record<string, unknown> = {};
      if (args.amount !== undefined) updates.amount = args.amount;
      if (args.category !== undefined) updates.category = args.category;
      if (args.note !== undefined) updates.note = args.note;
      if (args.date !== undefined) updates.date = args.date;
      if (args.type !== undefined) updates.type = args.type;
      if (!Object.keys(updates).length) throw new Error('Provide at least one field to update.');
      const { data, error } = await supabase.from('transactions').update(updates).eq('id', args.id as string).eq('user_id', userId).select().single();
      if (error) throw error;
      return { success: true, transaction: data };
    }

    case 'delete_transaction': {
      const { data: tx } = await supabase.from('transactions').select('*').eq('id', args.id as string).eq('user_id', userId).single();
      if (tx) {
        const delta = tx.type === 'income' ? -Number(tx.amount) : Number(tx.amount);
        await adjustAccountBalance(tx.account_id, delta, supabase);
      }
      const { error } = await supabase.from('transactions').delete().eq('id', args.id as string).eq('user_id', userId);
      if (error) throw error;
      return { success: true };
    }

    case 'bulk_delete_transactions': {
      if (!args.ids && !args.account_id && !args.type && !args.from_date && !args.to_date && !args.category)
        throw new Error('Provide at least one filter: ids, account_id, type, from_date, to_date, or category.');
      if (args.ids) {
        const { error } = await supabase.from('transactions').delete().in('id', args.ids as string[]).eq('user_id', userId);
        if (error) throw error;
        return { success: true, deleted: (args.ids as string[]).length };
      }
      let q = supabase.from('transactions').delete().eq('user_id', userId);
      if (args.account_id) q = (q as any).eq('account_id', args.account_id);
      if (args.type) q = (q as any).eq('type', args.type);
      if (args.from_date) q = (q as any).gte('date', args.from_date);
      if (args.to_date) q = (q as any).lte('date', args.to_date);
      if (args.category) q = (q as any).eq('category', args.category);
      const { error } = await q;
      if (error) throw error;
      return { success: true };
    }

    case 'create_account': {
      const { data, error } = await supabase.from('accounts').insert([{ user_id: userId, name: args.name, type: args.type, balance: args.initial_balance ?? 0 }]).select().single();
      if (error) throw error;
      return { success: true, account: data };
    }

    case 'update_account': {
      const updates: Record<string, unknown> = {};
      if (args.name !== undefined) updates.name = args.name;
      if (args.type !== undefined) updates.type = args.type;
      if (!Object.keys(updates).length) throw new Error('Provide at least one field to update (name or type). Balance cannot be edited directly.');
      const { data, error } = await supabase.from('accounts').update(updates).eq('id', args.id as string).eq('user_id', userId).select().single();
      if (error) throw error;
      return { success: true, account: data };
    }

    case 'delete_account': {
      const { error } = await supabase.from('accounts').delete().eq('id', args.id as string).eq('user_id', userId);
      if (error) throw error;
      return { success: true };
    }

    case 'add_investment': {
      const rp = args.return_percent ?? (args.invested_amount && args.current_value ? Number(((Number(args.current_value) - Number(args.invested_amount)) / Number(args.invested_amount) * 100).toFixed(2)) : 0);
      const { data, error } = await supabase.from('investments').insert([{ user_id: userId, name: args.name, type: args.type, invested_amount: args.invested_amount, current_value: args.current_value, quantity: args.quantity ?? null, return_percent: rp }]).select().single();
      if (error) throw error;
      return { success: true, investment: data };
    }

    case 'update_investment': {
      const updates: Record<string, unknown> = {};
      if (args.name !== undefined) updates.name = args.name;
      if (args.type !== undefined) updates.type = args.type;
      if (args.invested_amount !== undefined) updates.invested_amount = args.invested_amount;
      if (args.current_value !== undefined) updates.current_value = args.current_value;
      if (args.quantity !== undefined) updates.quantity = args.quantity;
      if (args.return_percent !== undefined) updates.return_percent = args.return_percent;
      else if (updates.invested_amount !== undefined && updates.current_value !== undefined)
        updates.return_percent = Number(((Number(updates.current_value) - Number(updates.invested_amount)) / Number(updates.invested_amount) * 100).toFixed(2));
      if (!Object.keys(updates).length) throw new Error('Provide at least one field to update.');
      const { data, error } = await supabase.from('investments').update(updates).eq('id', args.id as string).eq('user_id', userId).select().single();
      if (error) throw error;
      return { success: true, investment: data };
    }

    case 'delete_investment': {
      const { error } = await supabase.from('investments').delete().eq('id', args.id as string).eq('user_id', userId);
      if (error) throw error;
      return { success: true };
    }

    case 'add_goal': {
      const { data, error } = await supabase.from('goals').insert([{ user_id: userId, name: args.name, target_amount: args.target_amount, current_amount: args.current_amount ?? 0, deadline: args.deadline ?? null }]).select().single();
      if (error) throw error;
      return { success: true, goal: data };
    }

    case 'update_goal': {
      const updates: Record<string, unknown> = {};
      if (args.name !== undefined) updates.name = args.name;
      if (args.target_amount !== undefined) updates.target_amount = args.target_amount;
      if (args.current_amount !== undefined) updates.current_amount = args.current_amount;
      if (args.deadline !== undefined) updates.deadline = args.deadline;
      if (!Object.keys(updates).length) throw new Error('Provide at least one field to update.');
      const { data, error } = await supabase.from('goals').update(updates).eq('id', args.id as string).eq('user_id', userId).select().single();
      if (error) throw error;
      return { success: true, goal: data };
    }

    case 'update_goal_progress': {
      const { error } = await supabase.from('goals').update({ current_amount: args.current_amount }).eq('id', args.goal_id as string).eq('user_id', userId);
      if (error) throw error;
      return { success: true };
    }

    case 'delete_goal': {
      const { error } = await supabase.from('goals').delete().eq('id', args.id as string).eq('user_id', userId);
      if (error) throw error;
      return { success: true };
    }

    case 'add_emi': {
      const emi = { user_id: userId, name: args.name, principal: args.principal, interest_rate: args.interest_rate, tenure_months: args.tenure_months, emi_amount: args.emi_amount, start_date: args.start_date, paid_months: args.paid_months ?? 0 };
      const { data, error } = await supabase.from('emis').insert([emi]).select().single();
      if (error) throw error;
      return { success: true, emi: data };
    }

    case 'update_emi': {
      const updates: Record<string, unknown> = {};
      if (args.name !== undefined) updates.name = args.name;
      if (args.principal !== undefined) updates.principal = args.principal;
      if (args.interest_rate !== undefined) updates.interest_rate = args.interest_rate;
      if (args.emi_amount !== undefined) updates.emi_amount = args.emi_amount;
      if (args.tenure_months !== undefined) updates.tenure_months = args.tenure_months;
      if (args.paid_months !== undefined) updates.paid_months = args.paid_months;
      if (args.start_date !== undefined) updates.start_date = args.start_date;
      if (!Object.keys(updates).length) throw new Error('Provide at least one field to update.');
      const { data, error } = await supabase.from('emis').update(updates).eq('id', args.id as string).eq('user_id', userId).select().single();
      if (error) throw error;
      return { success: true, emi: data };
    }

    case 'delete_emi': {
      const { error } = await supabase.from('emis').delete().eq('id', args.id as string).eq('user_id', userId);
      if (error) throw error;
      return { success: true };
    }

    case 'reset_all_data': {
      if (args.confirm !== true) {
        const [t, i, g, e] = await Promise.all([
          supabase.from('transactions').select('id', { count: 'exact', head: true }).eq('user_id', userId),
          supabase.from('investments').select('id', { count: 'exact', head: true }).eq('user_id', userId),
          supabase.from('goals').select('id', { count: 'exact', head: true }).eq('user_id', userId),
          supabase.from('emis').select('id', { count: 'exact', head: true }).eq('user_id', userId),
        ]);
        return { dry_run: true, warning: 'Pass confirm=true to execute.', will_delete: { transactions: t.count ?? 0, investments: i.count ?? 0, goals: g.count ?? 0, emis: e.count ?? 0 }, kept: ['accounts', 'profile'] };
      }
      await Promise.all([
        supabase.from('transactions').delete().eq('user_id', userId),
        supabase.from('investments').delete().eq('user_id', userId),
        supabase.from('goals').delete().eq('user_id', userId),
        supabase.from('emis').delete().eq('user_id', userId),
      ]);
      return { success: true, message: 'All transactions, investments, goals, and EMIs deleted. Accounts and profile kept.' };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, mcp-protocol-version, mcp-session-id',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

function rpc(id: unknown, body: Record<string, unknown>) {
  return new Response(JSON.stringify({ jsonrpc: '2.0', id: id ?? null, ...body }), { headers: { ...CORS, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

  // Per MCP Streamable HTTP transport spec, GET is only for opening an SSE
  // stream for server-initiated messages. This server is stateless request/response
  // JSON-only, so a GET here must return 405 — not a tools/list payload — otherwise
  // a client probing for SSE support gets a confusing non-standard response and may
  // abort the whole connection (showing as "no tools available").
  if (req.method === 'GET') return new Response(null, { status: 405, headers: CORS });
  if (req.method !== 'POST') return new Response(null, { status: 405, headers: CORS });

  const url = new URL(req.url);
  const token = url.searchParams.get('token');
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  let json: any;
  try {
    json = await req.json();
  } catch {
    return rpc(null, { error: { code: -32700, message: 'Parse error: invalid JSON body' } });
  }

  const { method, id } = json || {};

  // JSON-RPC notifications (no "id") never get a JSON-RPC response body — only
  // a bare 202. Falling through to an error response here (as the previous
  // version did for notifications/initialized) makes some MCP clients treat
  // the whole handshake as failed and silently report zero tools.
  if (typeof method === 'string' && method.startsWith('notifications/')) {
    return new Response(null, { status: 202, headers: CORS });
  }

  if (method === 'ping') return rpc(id, { result: {} });

  // initialize and tools/list intentionally do NOT require the token — tool
  // schemas are not sensitive, and gating discovery on auth was the main
  // cause of "no tools available": any token timing/mismatch issue made
  // tools/list fail before the client ever saw the tool list. Only tools/call
  // (real data access) is auth-gated below.
  if (method === 'initialize') {
    return rpc(id, { result: { protocolVersion: '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'finfree', version: '2.1.0' } } });
  }

  if (method === 'tools/list') {
    return rpc(id, { result: { tools: TOOLS } });
  }

  // Defensive: respond gracefully if a client probes capabilities we didn't
  // declare, instead of erroring the whole session.
  if (method === 'resources/list') return rpc(id, { result: { resources: [] } });
  if (method === 'prompts/list') return rpc(id, { result: { prompts: [] } });

  if (method === 'tools/call') {
    if (!token) return rpc(id, { error: { code: -32001, message: 'Missing token. Add ?token=YOUR_TOKEN to the connector URL.' } });
    const userId = await getUserFromToken(token, supabase);
    if (!userId) return rpc(id, { error: { code: -32001, message: 'Invalid or expired token.' } });

    try {
      const { name, arguments: toolArgs = {} } = json.params || {};
      const result = await handleTool(name, toolArgs, userId, supabase);
      return rpc(id, { result: { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] } });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return rpc(id, { result: { content: [{ type: 'text', text: `Error: ${msg}` }], isError: true } });
    }
  }

  return rpc(id, { error: { code: -32601, message: `Method not found: ${method}` } });
});
