import Dexie, { type Table } from 'dexie';

export interface LocalProfile {
  id: string;
  name: string;
  age: number;
  monthly_salary: number;
  freedom_target: number;
  target_freedom_age: number;
  family_debt: number;
  is_admin: boolean;
  avatar_url?: string;
  updated_at: string;
}

export interface LocalAccount {
  id: string;
  user_id: string;
  name: string;
  type: string;
  balance: number;
  color?: string;
  icon?: string;
  created_at: string;
}

export interface LocalTransaction {
  id: string;
  user_id: string;
  account_id?: string;
  type: 'income' | 'expense' | 'transfer';
  category: string;
  amount: number;
  note?: string;
  description?: string;
  date: string;
  is_recurring: boolean;
  transfer_to_account_id?: string | null;
  created_at: string;
}

export interface LocalInvestment {
  id: string;
  user_id: string;
  name: string;
  type: string;
  invested_amount: number;
  current_value: number;
  units?: number;
  buy_price?: number | null;
  current_price?: number;
  notes?: string;
  purchase_date?: string;
  tracking_mode?: string;        // 'manual' | 'linked'
  symbol?: string | null;        // e.g. RELIANCE.NS, AAPL, MF:120503
  quantity?: number | null;
  created_at: string;
}

export interface LocalPreference {
  id: string;        // `${user_id}_${key}`
  user_id: string;
  key: string;       // 'budget_limits' | 'starred_accounts' | 'watchlist'
  value: unknown;
  updated_at: string;
}

export interface LocalEmi {
  id: string;
  user_id: string;
  name: string;
  bank: string;
  total_amount: number;
  emi_amount: number;
  interest_rate: number;
  tenure_months: number;
  paid_months: number;
  start_date: string;
  created_at: string;
}

export interface LocalGoal {
  id: string;
  user_id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  deadline?: string;
  icon?: string;
  color?: string;
  created_at: string;
}

export interface NetWorthSnapshot {
  id: string;         // "userId_YYYY-MM"
  user_id: string;
  month: string;      // "YYYY-MM"
  net_worth: number;
  liquid_cash: number;
  invested: number;
  debt: number;
  recorded_at: string;
}

export class FinFreeDB extends Dexie {
  profiles!: Table<LocalProfile>;
  accounts!: Table<LocalAccount>;
  transactions!: Table<LocalTransaction>;
  investments!: Table<LocalInvestment>;
  emis!: Table<LocalEmi>;
  goals!: Table<LocalGoal>;
  networth_snapshots!: Table<NetWorthSnapshot>;
  preferences!: Table<LocalPreference>;

  constructor() {
    super('FinFreeLocalDB');
    this.version(1).stores({
      profiles: 'id',
      accounts: 'id, user_id',
      transactions: 'id, user_id, account_id, date, type, category',
      investments: 'id, user_id',
      emis: 'id, user_id',
      goals: 'id, user_id',
    });
    this.version(2).stores({
      profiles: 'id',
      accounts: 'id, user_id',
      transactions: 'id, user_id, account_id, date, type, category',
      investments: 'id, user_id',
      emis: 'id, user_id',
      goals: 'id, user_id',
      networth_snapshots: 'id, user_id, month',
    });
    this.version(3).stores({
      profiles: 'id',
      accounts: 'id, user_id',
      transactions: 'id, user_id, account_id, date, type, category',
      investments: 'id, user_id',
      emis: 'id, user_id',
      goals: 'id, user_id',
      networth_snapshots: 'id, user_id, month',
      preferences: 'id, user_id, key',
    });
  }
}

export const localDb = new FinFreeDB();
