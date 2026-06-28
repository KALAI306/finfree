import { createClient } from "@supabase/supabase-js";
import { localDb } from './localdb';
import { getStorageMode } from './storageMode';
import { v4 as uuidv4 } from 'uuid';

const isLocal = () => getStorageMode() === 'local';

// Database Type Definitions
export interface Profile {
  id: string;
  name: string;
  age: number;
  monthly_salary: number;
  freedom_target: number;
  target_freedom_age: number;
  family_debt: number;
  is_admin: boolean;
  created_at: string;
}

export interface Account {
  id: string;
  user_id: string;
  name: string;
  type: string;
  balance: number;
  created_at: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  account_id: string;
  type: "income" | "expense" | "transfer";
  amount: number;
  category: string;
  note: string;
  date: string;
  is_recurring: boolean;
  transfer_to_account_id?: string | null;
  created_at: string;
}

export interface Investment {
  id: string;
  user_id: string;
  name: string;
  type: string;
  quantity: number | null;
  invested_amount: number;
  current_value: number;
  return_percent: number;
  created_at: string;
}

export interface EMI {
  id: string;
  user_id: string;
  name: string;
  principal: number;
  interest_rate: number;
  tenure_months: number;
  emi_amount: number;
  start_date: string;
  paid_months: number;
  created_at: string;
}

export interface Goal {
  id: string;
  user_id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  deadline?: string | null;
  created_at: string;
}

// Initialise Supabase Client if credentials exist
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

const isConfigured =
  supabaseUrl &&
  supabaseUrl !== "your_supabase_url_here" &&
  supabaseAnonKey &&
  supabaseAnonKey !== "your_supabase_anon_key_here";

export const supabase = isConfigured ? createClient(supabaseUrl, supabaseAnonKey) : null;

// Database Helpers
export async function getProfile(userId: string): Promise<Profile> {
  const { data, error } = await supabase!
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      console.log("Profile not found for user, seeding default data...", userId);
      try {
        await seedUserData(userId);
        const { data: retriedData, error: retryError } = await supabase!
          .from("profiles")
          .select("*")
          .eq("id", userId)
          .single();
        if (retryError) throw retryError;
        return retriedData;
      } catch (seedErr) {
        console.error("Failed to seed user data in getProfile:", seedErr);
        throw error;
      }
    }
    throw error;
  }
  return data;
}

export async function updateProfile(profile: Partial<Profile> & { id: string }): Promise<Profile> {
  if (isLocal()) {
    await localDb.profiles.update(profile.id, profile as any);
    return (await localDb.profiles.get(profile.id)) as unknown as Profile;
  }
  const { data, error } = await supabase!
    .from("profiles")
    .update(profile)
    .eq("id", profile.id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getAccounts(userId: string): Promise<Account[]> {
  const { data, error } = await supabase!
    .from("accounts")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function addAccount(account: Omit<Account, "id" | "created_at">): Promise<Account> {
  if (isLocal()) {
    const record = { ...account, id: uuidv4(), created_at: new Date().toISOString() } as Account;
    await localDb.accounts.put(record);
    return record;
  }
  const { data, error } = await supabase!.from("accounts").insert([account]).select().single();
  if (error) throw error;
  return data;
}

export async function updateAccountBalance(accountId: string, amountChange: number): Promise<void> {
  if (isLocal()) {
    const acc = await localDb.accounts.get(accountId);
    if (!acc) return;
    await localDb.accounts.update(accountId, { balance: Number((Number(acc.balance) + amountChange).toFixed(2)) });
    return;
  }
  const { data: currentAcc, error: getErr } = await supabase!.from("accounts").select("balance").eq("id", accountId).single();
  if (getErr) throw getErr;
  const newBalance = Number((Number(currentAcc.balance) + amountChange).toFixed(2));
  const { error: updErr } = await supabase!.from("accounts").update({ balance: newBalance }).eq("id", accountId);
  if (updErr) throw updErr;
}

export async function deleteAccount(accountId: string): Promise<void> {
  if (isLocal()) { await localDb.accounts.delete(accountId); return; }
  const { error } = await supabase!.from("accounts").delete().eq("id", accountId);
  if (error) throw error;
}

export async function updateAccount(account: Partial<Account> & { id: string }): Promise<Account> {
  if (isLocal()) {
    await localDb.accounts.update(account.id, account);
    const updated = await localDb.accounts.get(account.id);
    return updated as Account;
  }
  const { data, error } = await supabase!.from("accounts").update(account).eq("id", account.id).select().single();
  if (error) throw error;
  return data;
}

export async function getTransactions(userId: string): Promise<Transaction[]> {
  const { data, error } = await supabase!
    .from("transactions")
    .select("*")
    .eq("user_id", userId)
    .order("date", { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function addTransaction(tx: Omit<Transaction, "id" | "created_at">): Promise<Transaction> {
  let record: Transaction;
  if (isLocal()) {
    record = { ...tx, id: uuidv4(), created_at: new Date().toISOString() } as Transaction;
    await localDb.transactions.put(record as any);
  } else {
    const { data, error } = await supabase!.from("transactions").insert([tx]).select().single();
    if (error) throw error;
    record = data;
  }
  if (tx.type === "income") await updateAccountBalance(tx.account_id, tx.amount);
  else if (tx.type === "expense") await updateAccountBalance(tx.account_id, -tx.amount);
  else if (tx.type === "transfer" && tx.transfer_to_account_id) {
    await updateAccountBalance(tx.account_id, -tx.amount);
    await updateAccountBalance(tx.transfer_to_account_id, tx.amount);
  }
  return record;
}

export async function deleteTransaction(txId: string): Promise<void> {
  let txToDelete: any;
  if (isLocal()) {
    txToDelete = await localDb.transactions.get(txId);
    if (!txToDelete) return;
    await localDb.transactions.delete(txId);
  } else {
    const { data, error: findErr } = await supabase!.from("transactions").select("*").eq("id", txId).single();
    if (findErr || !data) return;
    txToDelete = data;
    const { error } = await supabase!.from("transactions").delete().eq("id", txId);
    if (error) throw error;
  }
  if (txToDelete.type === "income") await updateAccountBalance(txToDelete.account_id, -txToDelete.amount);
  else if (txToDelete.type === "expense") await updateAccountBalance(txToDelete.account_id, txToDelete.amount);
  else if (txToDelete.type === "transfer" && txToDelete.transfer_to_account_id) {
    await updateAccountBalance(txToDelete.account_id, txToDelete.amount);
    await updateAccountBalance(txToDelete.transfer_to_account_id, -txToDelete.amount);
  }
}

export async function updateTransaction(tx: Partial<Transaction> & { id: string }): Promise<Transaction> {
  const oldTx = isLocal()
    ? await localDb.transactions.get(tx.id)
    : await supabase!.from("transactions").select("*").eq("id", tx.id).single().then(r => r.data);

  if (!oldTx) throw new Error("Transaction not found");

  // Reverse old balance effect
  if (oldTx.type === "income") await updateAccountBalance(oldTx.account_id, -oldTx.amount);
  else if (oldTx.type === "expense") await updateAccountBalance(oldTx.account_id, oldTx.amount);
  else if (oldTx.type === "transfer" && oldTx.transfer_to_account_id) {
    await updateAccountBalance(oldTx.account_id, oldTx.amount);
    await updateAccountBalance(oldTx.transfer_to_account_id, -oldTx.amount);
  }

  const mergedTx = { ...oldTx, ...tx } as Transaction;

  if (isLocal()) {
    await localDb.transactions.update(tx.id, tx as any);
  } else {
    const { error } = await supabase!.from("transactions").update(tx).eq("id", tx.id);
    if (error) throw error;
  }

  // Apply new balance effect
  if (mergedTx.type === "income") await updateAccountBalance(mergedTx.account_id, mergedTx.amount);
  else if (mergedTx.type === "expense") await updateAccountBalance(mergedTx.account_id, -mergedTx.amount);
  else if (mergedTx.type === "transfer" && mergedTx.transfer_to_account_id) {
    await updateAccountBalance(mergedTx.account_id, -mergedTx.amount);
    await updateAccountBalance(mergedTx.transfer_to_account_id, mergedTx.amount);
  }

  return mergedTx;
}

export async function getInvestments(userId: string): Promise<Investment[]> {
  const { data, error } = await supabase!
    .from("investments")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function addInvestment(inv: Omit<Investment, "id" | "created_at">): Promise<Investment> {
  if (isLocal()) {
    const record = { ...inv, id: uuidv4(), created_at: new Date().toISOString() } as Investment;
    await localDb.investments.put(record);
    return record;
  }
  const { data, error } = await supabase!.from("investments").insert([inv]).select().single();
  if (error) throw error;
  return data;
}

export async function updateInvestment(inv: Partial<Investment> & { id: string }): Promise<Investment> {
  if (isLocal()) {
    await localDb.investments.update(inv.id, inv);
    return (await localDb.investments.get(inv.id)) as Investment;
  }
  const { data, error } = await supabase!.from("investments").update(inv).eq("id", inv.id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteInvestment(invId: string): Promise<void> {
  if (isLocal()) { await localDb.investments.delete(invId); return; }
  const { error } = await supabase!.from("investments").delete().eq("id", invId);
  if (error) throw error;
}

export async function getEmis(userId: string): Promise<EMI[]> {
  const { data, error } = await supabase!
    .from("emis")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function addEmi(emi: Omit<EMI, "id" | "created_at">): Promise<EMI> {
  if (isLocal()) {
    const record = { ...emi, id: uuidv4(), created_at: new Date().toISOString() } as unknown as EMI;
    await localDb.emis.put(record as any);
    return record;
  }
  const { data, error } = await supabase!.from("emis").insert([emi]).select().single();
  if (error) throw error;
  return data;
}

export async function updateEmi(emi: Partial<EMI> & { id: string }): Promise<EMI> {
  if (isLocal()) {
    await localDb.emis.update(emi.id, emi as any);
    return (await localDb.emis.get(emi.id)) as unknown as EMI;
  }
  const { data, error } = await supabase!.from("emis").update(emi).eq("id", emi.id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteEmi(emiId: string): Promise<void> {
  if (isLocal()) { await localDb.emis.delete(emiId); return; }
  const { error } = await supabase!.from("emis").delete().eq("id", emiId);
  if (error) throw error;
}

export async function getGoals(userId: string): Promise<Goal[]> {
  if (isLocal()) return localDb.goals.where('user_id').equals(userId).toArray() as Promise<Goal[]>;
  const { data, error } = await supabase!.from("goals").select("*").eq("user_id", userId).order("created_at", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function addGoal(goal: Omit<Goal, "id" | "created_at">): Promise<Goal> {
  if (isLocal()) {
    const record = { ...goal, id: uuidv4(), created_at: new Date().toISOString() } as Goal;
    await localDb.goals.put(record as any);
    return record;
  }
  const { data, error } = await supabase!.from("goals").insert([goal]).select().single();
  if (error) throw error;
  return data;
}

export async function updateGoal(goal: Partial<Goal> & { id: string }): Promise<Goal> {
  if (isLocal()) {
    await localDb.goals.update(goal.id, goal as any);
    return (await localDb.goals.get(goal.id)) as Goal;
  }
  const { data, error } = await supabase!.from("goals").update(goal).eq("id", goal.id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteGoal(goalId: string): Promise<void> {
  if (isLocal()) { await localDb.goals.delete(goalId); return; }
  const { error } = await supabase!.from("goals").delete().eq("id", goalId);
  if (error) throw error;
}

const ADMIN_EMAIL = "ganabathikalai143@gmail.com";

// Seeds a blank profile row on first signup
export async function seedUserData(userId: string) {
  let userName = "New User";
  let userEmail = "";
  try {
    const { data: { user } } = await supabase!.auth.getUser();
    if (user && user.email) {
      userEmail = user.email;
      const emailPrefix = user.email.split("@")[0];
      userName = emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1);
    }
  } catch (e) {
    // Ignore and fallback to "New User"
  }

  const { error: profErr } = await supabase!
    .from("profiles")
    .insert([{
      id: userId,
      name: userName,
      age: 25,
      monthly_salary: 0,
      freedom_target: 10000000,
      target_freedom_age: 50,
      family_debt: 0,
      is_admin: userEmail === ADMIN_EMAIL,
    }]);

  if (profErr) {
    console.error("Error creating user profile:", profErr);
    throw profErr;
  }

  // Seed starter goals — users can edit or delete these
  const starterGoals = [
    { user_id: userId, name: "Emergency Fund", target_amount: 50000, current_amount: 0, deadline: null },
    { user_id: userId, name: "Dream Vacation", target_amount: 25000, current_amount: 0, deadline: null },
    { user_id: userId, name: "New Gadget / Phone", target_amount: 15000, current_amount: 0, deadline: null },
    { user_id: userId, name: "Vehicle / Bike Fund", target_amount: 100000, current_amount: 0, deadline: null },
  ];
  await supabase!.from("goals").insert(starterGoals);
}

// Admin: get all user profiles
export async function adminGetAllProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase!
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

// Admin: get financial summary for a specific user
export async function adminGetUserSummary(userId: string) {
  const [accs, txs, invs, emis, goals] = await Promise.all([
    supabase!.from("accounts").select("*").eq("user_id", userId),
    supabase!.from("transactions").select("*").eq("user_id", userId),
    supabase!.from("investments").select("*").eq("user_id", userId),
    supabase!.from("emis").select("*").eq("user_id", userId),
    supabase!.from("goals").select("*").eq("user_id", userId),
  ]);
  return {
    accounts: accs.data || [],
    transactions: txs.data || [],
    investments: invs.data || [],
    emis: emis.data || [],
    goals: goals.data || [],
  };
}

// Admin: wipe all financial data for a user and reset profile
export async function adminResetUser(userId: string): Promise<void> {
  await Promise.all([
    supabase!.from("transactions").delete().eq("user_id", userId),
    supabase!.from("accounts").delete().eq("user_id", userId),
    supabase!.from("investments").delete().eq("user_id", userId),
    supabase!.from("emis").delete().eq("user_id", userId),
    supabase!.from("goals").delete().eq("user_id", userId),
  ]);
  await supabase!.from("profiles").update({
    monthly_salary: 0,
    freedom_target: 10000000,
    target_freedom_age: 50,
    family_debt: 0,
  }).eq("id", userId);
}

// Admin: delete a user's profile entirely
export async function adminDeleteUserProfile(userId: string): Promise<void> {
  await Promise.all([
    supabase!.from("transactions").delete().eq("user_id", userId),
    supabase!.from("accounts").delete().eq("user_id", userId),
    supabase!.from("investments").delete().eq("user_id", userId),
    supabase!.from("emis").delete().eq("user_id", userId),
    supabase!.from("goals").delete().eq("user_id", userId),
    supabase!.from("profiles").delete().eq("id", userId),
  ]);
}

// ── MCP Token helpers ─────────────────────────────────────────────────────────

export async function getMcpToken(userId: string): Promise<string | null> {
  const { data } = await supabase!.from('mcp_tokens').select('token').eq('user_id', userId).single();
  return data?.token ?? null;
}

export async function generateMcpToken(userId: string): Promise<string> {
  const { data, error } = await supabase!
    .from('mcp_tokens')
    .upsert({ user_id: userId }, { onConflict: 'user_id', ignoreDuplicates: false })
    .select('token')
    .single();
  if (error) throw error;
  return data.token;
}

export async function revokeMcpToken(userId: string): Promise<void> {
  await supabase!.from('mcp_tokens').delete().eq('user_id', userId);
}

export async function resetUserDatabase(userId: string): Promise<void> {
  await Promise.all([
    supabase!.from("transactions").delete().eq("user_id", userId),
    supabase!.from("accounts").delete().eq("user_id", userId),
    supabase!.from("investments").delete().eq("user_id", userId),
    supabase!.from("emis").delete().eq("user_id", userId),
    supabase!.from("goals").delete().eq("user_id", userId),
  ]);

  await supabase!
    .from("profiles")
    .update({
      monthly_salary: 0,
      freedom_target: 10000000,
      target_freedom_age: 50,
      family_debt: 0,
    })
    .eq("id", userId);
}
