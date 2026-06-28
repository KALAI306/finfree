import { supabase } from './db';
import { localDb } from './localdb';

const migrationKey = (userId: string) => `finfree_migrated_${userId}`;

export function isMigrated(userId: string): boolean {
  return localStorage.getItem(migrationKey(userId)) === '1';
}

/**
 * One-time fetch of all Supabase data into Dexie for a user.
 * Returns true if migration ran (first time), false if already migrated or failed.
 * Idempotent — safe to call multiple times.
 */
export async function migrateCloudToLocal(userId: string): Promise<boolean> {
  if (!supabase) return false;
  if (isMigrated(userId)) return false;

  try {
    const [profileRes, accountsRes, txRes, invRes, emiRes, goalRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).single(),
      supabase.from('accounts').select('*').eq('user_id', userId),
      supabase.from('transactions').select('*').eq('user_id', userId),
      supabase.from('investments').select('*').eq('user_id', userId),
      supabase.from('emis').select('*').eq('user_id', userId),
      supabase.from('goals').select('*').eq('user_id', userId),
    ]);

    if (profileRes.data) {
      await localDb.profiles.put(profileRes.data as any);
    }

    const accounts = accountsRes.data || [];
    const transactions = txRes.data || [];
    const investments = invRes.data || [];
    const emis = emiRes.data || [];
    const goals = goalRes.data || [];

    if (accounts.length) await localDb.accounts.bulkPut(accounts as any);
    if (transactions.length) await localDb.transactions.bulkPut(transactions as any);
    if (investments.length) await localDb.investments.bulkPut(investments as any);
    if (emis.length) await localDb.emis.bulkPut(emis as any);
    if (goals.length) await localDb.goals.bulkPut(goals as any);

    localStorage.setItem(migrationKey(userId), '1');
    return true;
  } catch (err) {
    console.error('Cloud→local migration failed:', err);
    return false;
  }
}
