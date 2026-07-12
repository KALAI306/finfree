import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const INVESTMENT_TYPES = ['mutual_fund', 'stock', 'gold', 'silver'] as const;
const ACCOUNT_TYPES = ['savings', 'current', 'cash', 'wallet', 'fd', 'ppf', 'nps', 'crypto', 'salary', 'investment', 'emergency', 'other'];

const TOOLS = [
  // ── READ ──────────────────────────────────────────────────────────────────────
  {
    name: 'financial_summary',
    description: "Get a complete financial snapshot: net worth, accounts, monthly income/expenses, investments, EMIs, goals, and budget health. Use this first to understand the user's financial picture before any other query.",
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
    description: 'List all investments with invested amount, current value, return percentage, tracking mode (manual/live), live ticker symbol, and purchase date.',
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
  {
    name: 'list_budgets',
    description: "List all monthly budget limits with this month's actual spending, percent used, and status (ok / warning / over). Use this to check budget health or before setting/removing a budget.",
    inputSchema: { type: 'object', properties: {} },
  },
  // ── TRANSACTIONS ──────────────────────────────────────────────────────────────
  {
    name: 'add_transaction',
    description: "Record a single income or expense transaction. Provide either account_id (from list_accounts) or account_name (matched case-insensitively) — account_name is easier when you don't already have the UUID.",
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
    name: 'transfer_funds',
    description: 'Move money between two of the user\'s own accounts (internal transfer). Deducts from the source account and credits the destination account, recorded as a single transfer transaction. Use this instead of add_transaction for account-to-account moves. Identify each account by id or name.',
    inputSchema: {
      type: 'object',
      required: ['amount'],
      properties: {
        from_account_id:   { type: 'string', description: 'Source account UUID (use this OR from_account_name)' },
        from_account_name: { type: 'string', description: 'Source account name, case-insensitive (use this OR from_account_id)' },
        to_account_id:     { type: 'string', description: 'Destination account UUID (use this OR to_account_name)' },
        to_account_name:   { type: 'string', description: 'Destination account name, case-insensitive (use this OR to_account_id)' },
        amount:            { type: 'number', description: 'Positive amount to transfer' },
        date:              { type: 'string', description: 'YYYY-MM-DD, defaults to today' },
        note:              { type: 'string', description: 'Optional note' },
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
    description: "Update an account's name or type by ID. Provide name, type, or both — only supplied fields are changed. Balance is NOT editable here — it is auto-calculated from transactions.",
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: {
        id:   { type: 'string', description: 'Account UUID from list_accounts' },
        name: { type: 'string', description: 'New account name' },
        type: { type: 'string', description: `New account type. Valid values: ${ACCOUNT_TYPES.join(', ')}. Custom strings are also accepted.` },
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
        tracking_mode:   { type: 'string', enum: ['manual', 'linked'], description: '"manual" = you update current_value yourself; "linked" = current_value auto-updated from live market data each time Investments page opens. Default is "manual". When "linked", symbol is required (except gold/silver which auto-use GC=F / SI=F).' },
        symbol:          { type: 'string', description: 'Live price source. Indian stocks → "RELIANCE.NS"; US stocks → "AAPL"; Mutual funds → "MF:101206" (MF: prefix + AMFI scheme code from mfapi.in); Gold → "GC=F" (auto-set if type=gold); Silver → "SI=F" (auto-set if type=silver). Required when tracking_mode is "linked" for non-commodity types.' },
        buy_price:       { type: 'number', description: 'Average buy price per unit. ₹/share for Indian stocks; USD/share for US stocks; ₹/NAV-unit for mutual funds; ₹/gram for gold and silver. Used with quantity to compute invested_amount.' },
        purchase_date:   { type: 'string', description: 'Date the investment was purchased, YYYY-MM-DD. Used to calculate CAGR accurately. If omitted, the record creation date is used as a fallback (which will show 0% CAGR for new records).' },
      },
    },
  },
  {
    name: 'update_investment',
    description: 'Update an existing investment by ID. Only provided fields are changed. Return % is auto-calculated when both invested_amount and current_value are updated. To switch to live price tracking set tracking_mode="linked" and provide a symbol (see symbol field for format). For gold/silver the symbol is auto-set — just set tracking_mode="linked" and supply quantity (grams) and buy_price (₹/gram).',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: {
        id:              { type: 'string', description: 'Investment UUID from list_investments' },
        name:            { type: 'string', description: 'New investment name' },
        type:            { type: 'string', enum: [...INVESTMENT_TYPES], description: `New type, lowercase. One of: ${INVESTMENT_TYPES.join(', ')}` },
        invested_amount: { type: 'number', description: 'New cost basis / total amount invested in ₹' },
        current_value:   { type: 'number', description: 'New current market value in ₹' },
        quantity:        { type: 'number', description: 'Units held (shares for stocks, NAV units for mutual funds, grams for gold/silver)' },
        return_percent:  { type: 'number', description: 'Explicit return %, or omit to auto-calculate when both invested_amount and current_value are provided' },
        tracking_mode:   { type: 'string', enum: ['manual', 'linked'], description: '"manual" = user updates current_value manually; "linked" = current_value auto-updated from live market data each time the Investments page opens. When setting to "linked", symbol is required (except for gold/silver which auto-use GC=F / SI=F).' },
        symbol:          { type: 'string', description: 'Live price source. Format by asset type: Indian stocks → "RELIANCE.NS" / "HDFCBANK.BO"; US stocks → "AAPL" / "AMD"; Indian ETFs → "NIFTYBEES.NS"; Mutual funds → "MF:101206" (MF: prefix + AMFI scheme code from mfapi.in); Gold → "GC=F" (auto-set if type=gold); Silver → "SI=F" (auto-set if type=silver). Not needed for manual mode.' },
        buy_price:       { type: 'number', description: 'Average buy price per unit. Unit depends on asset type: ₹/share for Indian stocks; USD/share for US stocks; ₹/NAV-unit for mutual funds; ₹/gram for gold and silver. The app uses this with quantity to compute invested_amount and track return %.' },
        purchase_date:   { type: 'string', description: 'Original purchase date YYYY-MM-DD. Corrects CAGR calculation — if the investment was bought before it was added to the app, set this to the actual purchase date.' },
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
  // ── BUDGETS ───────────────────────────────────────────────────────────────────
  {
    name: 'set_budget',
    description: 'Create or update a monthly spending limit for a category (upsert). The category must match the category strings used in transactions (e.g. "Food 🍕"). Use list_budgets first to see existing limits.',
    inputSchema: {
      type: 'object',
      required: ['category', 'monthly_limit'],
      properties: {
        category:      { type: 'string', description: 'Category name exactly as used in transactions, e.g. "Food 🍕", "Fuel ⛽", "Entertainment 🎬"' },
        monthly_limit: { type: 'number', description: 'Monthly spending limit in rupees (must be > 0)' },
      },
    },
  },
  {
    name: 'delete_budget',
    description: 'Remove the monthly budget limit for a category. The category name is matched case-insensitively (partial match ok).',
    inputSchema: {
      type: 'object',
      required: ['category'],
      properties: {
        category: { type: 'string', description: 'Category name to remove the limit for (partial match ok, e.g. "food" matches "Food 🍕")' },
      },
    },
  },
  // ── PROFILE ───────────────────────────────────────────────────────────────────
  {
    name: 'update_profile',
    description: 'Update the user profile — monthly salary, financial freedom target, display name, or age. Only provided fields are changed.',
    inputSchema: {
      type: 'object',
      properties: {
        name:           { type: 'string',  description: 'Display name' },
        age:            { type: 'number',  description: 'Age in years' },
        monthly_salary: { type: 'number',  description: 'Monthly take-home salary in rupees' },
        freedom_target: { type: 'number',  description: 'Financial freedom net worth target in rupees' },
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
  // Chit Fund tools
  { name: 'list_chit_funds', description: 'List all chit funds (seettus) for the user', inputSchema: { type: 'object', properties: {} } },
  { name: 'add_chit_fund', description: 'Create a new chit fund', inputSchema: { type: 'object', required: ['name', 'total_value', 'total_members', 'monthly_contribution', 'start_date'], properties: { name: { type: 'string' }, total_value: { type: 'number' }, total_members: { type: 'integer' }, monthly_contribution: { type: 'number' }, frequency: { type: 'string', enum: ['monthly', 'bimonthly', 'quarterly', 'custom'] }, start_date: { type: 'string' }, my_turn_number: { type: 'integer' }, commission_percent: { type: 'number' } } } },
  { name: 'update_chit_fund', description: 'Update a chit fund', inputSchema: { type: 'object', required: ['id'], properties: { id: { type: 'string' }, name: { type: 'string' }, status: { type: 'string' }, my_turn_number: { type: 'integer' } } } },
  { name: 'delete_chit_fund', description: 'Delete a chit fund', inputSchema: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } } },
  { name: 'list_chit_members', description: 'List members of a chit fund', inputSchema: { type: 'object', required: ['chit_id'], properties: { chit_id: { type: 'string' } } } },
  { name: 'record_chit_payment', description: 'Record a chit fund payment/alem', inputSchema: { type: 'object', required: ['chit_id', 'round_number', 'alem_date', 'amount_paid'], properties: { chit_id: { type: 'string' }, round_number: { type: 'integer' }, alem_date: { type: 'string' }, amount_paid: { type: 'number' }, payment_status: { type: 'string' }, notes: { type: 'string' } } } },
  { name: 'get_chit_summary', description: 'Get summary of a chit fund including net position', inputSchema: { type: 'object', required: ['chit_id'], properties: { chit_id: { type: 'string' } } } },
  // Lending tools
  { name: 'list_lendings', description: 'List all lending/borrowing records. Filter by type (lent/borrowed) and status', inputSchema: { type: 'object', properties: { type: { type: 'string', enum: ['lent', 'borrowed'] }, status: { type: 'string', enum: ['active', 'partially_paid', 'settled', 'written_off'] } } } },
  { name: 'add_lending', description: 'Record money lent or borrowed', inputSchema: { type: 'object', required: ['type', 'person_name', 'amount', 'lent_date'], properties: { type: { type: 'string', enum: ['lent', 'borrowed'] }, person_name: { type: 'string' }, person_phone: { type: 'string' }, amount: { type: 'number' }, lent_date: { type: 'string' }, due_date: { type: 'string' }, reason: { type: 'string' } } } },
  { name: 'record_lending_payment', description: 'Record a partial or full repayment', inputSchema: { type: 'object', required: ['lending_id', 'amount'], properties: { lending_id: { type: 'string' }, amount: { type: 'number' }, payment_date: { type: 'string' }, notes: { type: 'string' } } } },
  { name: 'settle_lending', description: 'Mark a lending record as fully settled', inputSchema: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } } },
  { name: 'get_lending_summary', description: 'Get total lent, borrowed, and net position', inputSchema: { type: 'object', properties: {} } },
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
      const [profileRes, accsRes, txRes, invRes, emiRes, goalRes, budgetRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId).single(),
        supabase.from('accounts').select('*').eq('user_id', userId),
        supabase.from('transactions').select('*').eq('user_id', userId),
        supabase.from('investments').select('*').eq('user_id', userId),
        supabase.from('emis').select('*').eq('user_id', userId),
        supabase.from('goals').select('*').eq('user_id', userId),
        supabase.from('budgets').select('*').eq('user_id', userId),
      ]);
      const profile = (profileRes.data || {}) as Record<string, unknown>;
      const accounts = accsRes.data || [];
      const txs = txRes.data || [];
      const investments = invRes.data || [];
      const emis = emiRes.data || [];
      const goals = goalRes.data || [];
      const budgets = budgetRes.data || [];
      const totalCash = accounts.reduce((s: number, a: any) => s + Number(a.balance), 0);
      const totalInvested = investments.reduce((s: number, i: any) => s + Number(i.current_value), 0);
      const netWorth = totalCash + totalInvested - Number(profile.family_debt || 0);
      const monthStr = new Date().toISOString().slice(0, 7);
      const monthTxs = txs.filter((t: any) => t.date?.startsWith(monthStr));
      const monthExpenseTxs = monthTxs.filter((t: any) => t.type === 'expense' && !t.transfer_to_account_id);
      const monthIncome = monthTxs.filter((t: any) => t.type === 'income').reduce((s: number, t: any) => s + Number(t.amount), 0);
      const monthExpense = monthExpenseTxs.reduce((s: number, t: any) => s + Number(t.amount), 0);
      const budgetHealth = budgets.map((b: any) => {
        const spent = monthExpenseTxs.filter((t: any) => t.category === b.category).reduce((s: number, t: any) => s + Number(t.amount), 0);
        const pct = b.monthly_limit > 0 ? Math.round((spent / b.monthly_limit) * 100) : 0;
        return { category: b.category, limit: b.monthly_limit, spent, pct, status: pct > 100 ? 'over' : pct >= 80 ? 'warning' : 'ok' };
      });
      return {
        profile: { name: profile.name, age: profile.age, monthly_salary: profile.monthly_salary, freedom_target: profile.freedom_target },
        net_worth: { total: netWorth, liquid_cash: totalCash, invested: totalInvested, family_debt: profile.family_debt },
        this_month: { income: monthIncome, expenses: monthExpense, saved: monthIncome - monthExpense, savings_rate_pct: monthIncome > 0 ? Math.round(((monthIncome - monthExpense) / monthIncome) * 100) : null },
        accounts: accounts.map((a: any) => ({ id: a.id, name: a.name, type: a.type, balance: a.balance })),
        investments: investments.map((i: any) => ({ id: i.id, name: i.name, type: i.type, invested: i.invested_amount, current_value: i.current_value, return_percent: i.return_percent, tracking_mode: i.tracking_mode || 'manual', symbol: i.symbol || null, purchase_date: i.purchase_date || null })),
        emis: emis.map((e: any) => ({ id: e.id, name: e.name, emi_amount: e.emi_amount, principal: e.principal, paid_months: e.paid_months, tenure_months: e.tenure_months })),
        goals: goals.map((g: any) => ({ id: g.id, name: g.name, target: g.target_amount, saved: g.current_amount, progress_pct: g.target_amount > 0 ? Math.round((g.current_amount / g.target_amount) * 100) : 0, deadline: g.deadline })),
        budget_health: { budgets: budgetHealth, over_count: budgetHealth.filter((b: any) => b.status === 'over').length, warning_count: budgetHealth.filter((b: any) => b.status === 'warning').length },
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

    case 'list_budgets': {
      const { data: budgets, error } = await supabase.from('budgets').select('*').eq('user_id', userId).order('category');
      if (error) throw error;
      if (!(budgets || []).length) return { budgets: [], message: "No budgets set yet. Use set_budget to create spending limits." };
      const monthStr = new Date().toISOString().slice(0, 7);
      const { data: txs } = await supabase.from('transactions').select('category,amount,transfer_to_account_id').eq('user_id', userId).eq('type', 'expense').like('date', `${monthStr}%`);
      const monthExpenses = (txs || []).filter((t: any) => !t.transfer_to_account_id);
      const rows = (budgets || []).map((b: any) => {
        const spent = monthExpenses.filter((t: any) => t.category === b.category).reduce((s: number, t: any) => s + Number(t.amount), 0);
        const pct = b.monthly_limit > 0 ? Math.round((spent / b.monthly_limit) * 100) : 0;
        return { id: b.id, category: b.category, monthly_limit: b.monthly_limit, spent_this_month: spent, percent_used: pct, remaining: Math.max(0, b.monthly_limit - spent), status: pct > 100 ? 'over' : pct >= 80 ? 'warning' : 'ok' };
      });
      return { month: monthStr, budgets: rows, summary: { total_budget: rows.reduce((s: number, r: any) => s + r.monthly_limit, 0), total_spent: rows.reduce((s: number, r: any) => s + r.spent_this_month, 0), over_count: rows.filter((r: any) => r.status === 'over').length, warning_count: rows.filter((r: any) => r.status === 'warning').length, ok_count: rows.filter((r: any) => r.status === 'ok').length } };
    }

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

    case 'transfer_funds': {
      const amount = Number(args.amount);
      if (!(amount > 0)) throw new Error('amount must be a positive number.');
      const fromId = await resolveAccountId({ account_id: args.from_account_id, account_name: args.from_account_name }, userId, supabase);
      const toId = await resolveAccountId({ account_id: args.to_account_id, account_name: args.to_account_name }, userId, supabase);
      if (fromId === toId) throw new Error('Source and destination accounts must be different.');
      const date = (args.date as string) || new Date().toISOString().slice(0, 10);
      const { data, error } = await supabase.from('transactions').insert([{
        user_id: userId, type: 'transfer', amount, category: 'Transfer 🔁',
        account_id: fromId, transfer_to_account_id: toId, date, note: args.note || '', is_recurring: false,
      }]).select().single();
      if (error) throw error;
      await adjustAccountBalance(fromId, -amount, supabase);
      await adjustAccountBalance(toId, amount, supabase);
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
      if (args.tracking_mode === 'linked') {
        if (!args.symbol) {
          const t = args.type as string | undefined;
          if (t === 'gold')        args = { ...args, symbol: 'GC=F' };
          else if (t === 'silver') args = { ...args, symbol: 'SI=F' };
          else throw new Error("symbol is required when tracking_mode is 'linked'. For stocks use e.g. 'RELIANCE.NS'; for mutual funds use 'MF:<amfi_code>'; gold/silver are auto-assigned.");
        }
      }
      const rp = args.return_percent ?? (args.invested_amount && args.current_value ? Number(((Number(args.current_value) - Number(args.invested_amount)) / Number(args.invested_amount) * 100).toFixed(2)) : 0);
      const { data, error } = await supabase.from('investments').insert([{
        user_id: userId,
        name: args.name,
        type: args.type,
        invested_amount: args.invested_amount,
        current_value: args.current_value,
        quantity: args.quantity ?? null,
        return_percent: rp,
        tracking_mode: args.tracking_mode ?? 'manual',
        symbol: args.symbol ?? null,
        buy_price: args.buy_price ?? null,
        purchase_date: args.purchase_date ?? null,
      }]).select().single();
      if (error) throw error;
      return { success: true, investment: data };
    }

    case 'update_investment': {
      // For linked mode, resolve the symbol (auto-assign for gold/silver, validate for others)
      if (args.tracking_mode === 'linked') {
        if (!args.symbol) {
          // Determine the effective type (from args or existing record)
          let effectiveType = args.type as string | undefined;
          if (!effectiveType) {
            const { data: existing } = await supabase.from('investments').select('type, symbol').eq('id', args.id as string).eq('user_id', userId).single();
            effectiveType = existing?.type;
            // If already has a symbol and we're not changing it, that's fine too
            if (!args.symbol && existing?.symbol) args = { ...args, symbol: existing.symbol };
          }
          // Auto-assign commodity symbols
          if (effectiveType === 'gold')   args = { ...args, symbol: 'GC=F' };
          else if (effectiveType === 'silver') args = { ...args, symbol: 'SI=F' };
          else if (!args.symbol) {
            // Non-commodity: still need a symbol — check existing
            const { data: existing } = await supabase.from('investments').select('symbol').eq('id', args.id as string).eq('user_id', userId).single();
            if (!existing?.symbol) throw new Error("symbol is required when setting tracking_mode to 'linked'. For stocks use e.g. 'RELIANCE.NS'; for mutual funds use 'MF:<amfi_code>'; gold/silver are auto-assigned.");
          }
        }
      }
      const updates: Record<string, unknown> = {};
      if (args.name !== undefined) updates.name = args.name;
      if (args.type !== undefined) updates.type = args.type;
      if (args.invested_amount !== undefined) updates.invested_amount = args.invested_amount;
      if (args.current_value !== undefined) updates.current_value = args.current_value;
      if (args.quantity !== undefined) updates.quantity = args.quantity;
      if (args.tracking_mode !== undefined) updates.tracking_mode = args.tracking_mode;
      if (args.symbol !== undefined) updates.symbol = args.symbol;
      if (args.buy_price !== undefined) updates.buy_price = args.buy_price;
      if (args.purchase_date !== undefined) updates.purchase_date = args.purchase_date;
      if (args.return_percent !== undefined) {
        updates.return_percent = args.return_percent;
      } else if (updates.invested_amount !== undefined && updates.current_value !== undefined) {
        updates.return_percent = Number(((Number(updates.current_value) - Number(updates.invested_amount)) / Number(updates.invested_amount) * 100).toFixed(2));
      }
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

    case 'set_budget': {
      if (!args.category || (args.monthly_limit as number) <= 0) {
        throw new Error('Provide a category and a monthly_limit greater than 0.');
      }
      const { error } = await supabase.from('budgets').upsert(
        { user_id: userId, category: args.category, monthly_limit: args.monthly_limit, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,category' }
      );
      if (error) throw error;
      return { success: true, message: `Budget set: ${args.category} → ₹${args.monthly_limit}/month` };
    }

    case 'delete_budget': {
      const { data: budgets } = await supabase.from('budgets').select('id,category').eq('user_id', userId);
      const q = String(args.category).toLowerCase();
      const match = (budgets || []).find((b: any) => b.category.toLowerCase().includes(q));
      if (!match) throw new Error(`No budget found matching "${args.category}". Use list_budgets to see all categories.`);
      const { error } = await supabase.from('budgets').delete().eq('id', (match as any).id);
      if (error) throw error;
      return { success: true, message: `Budget removed for "${(match as any).category}"` };
    }

    case 'update_profile': {
      const updates: Record<string, unknown> = {};
      if (args.name !== undefined) updates.name = args.name;
      if (args.age !== undefined) updates.age = args.age;
      if (args.monthly_salary !== undefined) updates.monthly_salary = args.monthly_salary;
      if (args.freedom_target !== undefined) updates.freedom_target = args.freedom_target;
      if (!Object.keys(updates).length) throw new Error('Provide at least one field to update: name, age, monthly_salary, or freedom_target.');
      const { data, error } = await supabase.from('profiles').update(updates).eq('id', userId).select().single();
      if (error) throw error;
      return { success: true, profile: data };
    }

    case 'reset_all_data': {
      if (args.confirm !== true) {
        const [t, i, g, e] = await Promise.all([
          supabase.from('transactions').select('id', { count: 'exact', head: true }).eq('user_id', userId),
          supabase.from('investments').select('id', { count: 'exact', head: true }).eq('user_id', userId),
          supabase.from('goals').select('id', { count: 'exact', head: true }).eq('user_id', userId),
          supabase.from('emis').select('id', { count: 'exact', head: true }).eq('user_id', userId),
        ]);
        return { dry_run: true, warning: 'Pass confirm=true to execute.', will_delete: { transactions: t.count ?? 0, investments: i.count ?? 0, goals: g.count ?? 0, emis: e.count ?? 0 }, kept: ['accounts', 'profile', 'budgets'] };
      }
      await Promise.all([
        supabase.from('transactions').delete().eq('user_id', userId),
        supabase.from('investments').delete().eq('user_id', userId),
        supabase.from('goals').delete().eq('user_id', userId),
        supabase.from('emis').delete().eq('user_id', userId),
      ]);
      return { success: true, message: 'All transactions, investments, goals, and EMIs deleted. Accounts, profile, and budgets kept.' };
    }

    // ── CHIT FUNDS ──────────────────────────────────────────────
    case 'list_chit_funds': {
      const { data } = await supabase.from('chit_funds').select('*').eq('user_id', userId).order('created_at', { ascending: false });
      return data || [];
    }
    case 'add_chit_fund': {
      const { data, error } = await supabase.from('chit_funds').insert({ ...args, user_id: userId }).select().single();
      if (error) throw error;
      return data;
    }
    case 'update_chit_fund': {
      const { id: cid, ...rest } = args as any;
      const { error } = await supabase.from('chit_funds').update(rest).eq('id', cid).eq('user_id', userId);
      if (error) throw error;
      return { success: true };
    }
    case 'delete_chit_fund': {
      const { error } = await supabase.from('chit_funds').delete().eq('id', args.id).eq('user_id', userId);
      if (error) throw error;
      return { success: true };
    }
    case 'list_chit_members': {
      const { data } = await supabase.from('chit_members').select('*').eq('chit_id', args.chit_id).order('turn_number');
      return data || [];
    }
    case 'record_chit_payment': {
      const { data, error } = await supabase.from('chit_payments').insert({ ...args, user_id: userId }).select().single();
      if (error) throw error;
      return data;
    }
    case 'get_chit_summary': {
      const [chitRes, membersRes, paymentsRes] = await Promise.all([
        supabase.from('chit_funds').select('*').eq('id', args.chit_id).eq('user_id', userId).single(),
        supabase.from('chit_members').select('*').eq('chit_id', args.chit_id),
        supabase.from('chit_payments').select('*').eq('chit_id', args.chit_id),
      ]);
      const chit = chitRes.data;
      const members = membersRes.data || [];
      const payments = paymentsRes.data || [];
      const collected = members.filter((m: any) => m.status === 'collected').length;
      const totalPaid = payments.filter((p: any) => p.payment_status === 'paid').reduce((s: number, p: any) => s + Number(p.amount_paid), 0);
      return { chit, members_collected: collected, total_members: members.length, total_paid: totalPaid, rounds_remaining: (chit?.total_members || 0) - collected };
    }

    // ── LENDING ───────────────────────────────────────────────
    case 'list_lendings': {
      let q = supabase.from('money_lending').select('*').eq('user_id', userId);
      if (args.type) q = q.eq('type', args.type);
      if (args.status) q = q.eq('status', args.status);
      const { data } = await q.order('created_at', { ascending: false });
      return data || [];
    }
    case 'add_lending': {
      const record = { ...args, user_id: userId, remaining_amount: args.remaining_amount ?? args.amount };
      const { data, error } = await supabase.from('money_lending').insert(record).select().single();
      if (error) throw error;
      return data;
    }
    case 'record_lending_payment': {
      const { lending_id, amount, payment_date, notes: pnotes } = args as any;
      const { data: pay, error: pe } = await supabase.from('lending_payments').insert({ lending_id, user_id: userId, amount, payment_date: payment_date || new Date().toISOString().slice(0, 10), notes: pnotes }).select().single();
      if (pe) throw pe;
      const { data: lending } = await supabase.from('money_lending').select('remaining_amount').eq('id', lending_id).single();
      const newRem = Math.max(0, Number(lending?.remaining_amount || 0) - Number(amount));
      await supabase.from('money_lending').update({ remaining_amount: newRem, status: newRem <= 0 ? 'settled' : 'partially_paid' }).eq('id', lending_id);
      return { payment: pay, new_remaining: newRem, settled: newRem <= 0 };
    }
    case 'settle_lending': {
      const { error } = await supabase.from('money_lending').update({ remaining_amount: 0, status: 'settled' }).eq('id', args.id).eq('user_id', userId);
      if (error) throw error;
      return { success: true };
    }
    case 'get_lending_summary': {
      const { data } = await supabase.from('money_lending').select('*').eq('user_id', userId);
      const records = data || [];
      const active = records.filter((r: any) => r.status === 'active' || r.status === 'partially_paid');
      const lent = active.filter((r: any) => r.type === 'lent');
      const borrowed = active.filter((r: any) => r.type === 'borrowed');
      return {
        total_lent: lent.reduce((s: number, r: any) => s + Number(r.remaining_amount), 0),
        lent_to_people: lent.length,
        total_borrowed: borrowed.reduce((s: number, r: any) => s + Number(r.remaining_amount), 0),
        borrowed_from_people: borrowed.length,
        net_position: lent.reduce((s: number, r: any) => s + Number(r.remaining_amount), 0) - borrowed.reduce((s: number, r: any) => s + Number(r.remaining_amount), 0),
      };
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

  if (typeof method === 'string' && method.startsWith('notifications/')) {
    return new Response(null, { status: 202, headers: CORS });
  }

  if (method === 'ping') return rpc(id, { result: {} });

  if (method === 'initialize') {
    return rpc(id, {
      result: {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: {
          name: 'finfree',
          title: 'FinFree',
          version: '3.3.0',
          websiteUrl: 'https://finfree-teal.vercel.app',
          icons: [{ src: 'https://finfree-teal.vercel.app/icon-512.png', mimeType: 'image/png', sizes: ['512x512'] }],
        },
      },
    });
  }

  if (method === 'tools/list') {
    return rpc(id, { result: { tools: TOOLS } });
  }

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
