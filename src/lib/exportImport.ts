import { localDb } from './localdb';
import { supabase } from './db';
import { getStorageMode } from './storageMode';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

export interface FinFreeBackup {
  version: string;
  exported_at: string;
  mode: 'local' | 'cloud';
  profile: any;
  accounts: any[];
  transactions: any[];
  investments: any[];
  emis: any[];
  goals: any[];
}

// ─── EXPORT ───────────────────────────────────────────────────────────────────

export async function exportData(userId: string): Promise<FinFreeBackup> {
  const mode = getStorageMode();

  if (mode === 'local') {
    const [profile, accounts, transactions, investments, emis, goals] = await Promise.all([
      localDb.profiles.get(userId),
      localDb.accounts.where('user_id').equals(userId).toArray(),
      localDb.transactions.where('user_id').equals(userId).toArray(),
      localDb.investments.where('user_id').equals(userId).toArray(),
      localDb.emis.where('user_id').equals(userId).toArray(),
      localDb.goals.where('user_id').equals(userId).toArray(),
    ]);
    return {
      version: '1.0',
      exported_at: new Date().toISOString(),
      mode: 'local',
      profile: profile || {},
      accounts,
      transactions,
      investments,
      emis,
      goals,
    };
  } else {
    if (!supabase) throw new Error('Supabase not available');
    const [profile, accounts, transactions, investments, emis, goals] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).single(),
      supabase.from('accounts').select('*').eq('user_id', userId),
      supabase.from('transactions').select('*').eq('user_id', userId),
      supabase.from('investments').select('*').eq('user_id', userId),
      supabase.from('emis').select('*').eq('user_id', userId),
      supabase.from('goals').select('*').eq('user_id', userId),
    ]);
    return {
      version: '1.0',
      exported_at: new Date().toISOString(),
      mode: 'cloud',
      profile: profile.data || {},
      accounts: accounts.data || [],
      transactions: transactions.data || [],
      investments: investments.data || [],
      emis: emis.data || [],
      goals: goals.data || [],
    };
  }
}

async function saveAndShareFile(filename: string, content: string, mimeType: string) {
  if (Capacitor.isNativePlatform()) {
    // Write to cache dir then share (works on Android & iOS)
    await Filesystem.writeFile({
      path: filename,
      data: content,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    });
    const { uri } = await Filesystem.getUri({ path: filename, directory: Directory.Cache });
    await Share.share({ title: filename, url: uri, dialogTitle: 'Save ' + filename });
  } else {
    // Web: use blob download
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

export async function downloadBackupJSON(backup: FinFreeBackup) {
  const json = JSON.stringify(backup, null, 2);
  const date = new Date().toISOString().split('T')[0];
  await saveAndShareFile(`finfree-backup-${date}.json`, json, 'application/json');
}

export async function downloadTransactionsCSV(transactions: any[]) {
  if (!transactions.length) return;
  const headers = ['Date', 'Type', 'Category', 'Amount', 'Description', 'Account'];
  const rows = transactions.map(t => [
    t.date, t.type, t.category, t.amount, t.description || '', t.account_id || '',
  ]);
  const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
  const date = new Date().toISOString().split('T')[0];
  await saveAndShareFile(`finfree-transactions-${date}.csv`, csv, 'text/csv');
}

// ─── IMPORT ───────────────────────────────────────────────────────────────────

export function readBackupFile(file: File): Promise<FinFreeBackup> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        if (!data.version || !data.transactions) {
          reject(new Error('Invalid FinFree backup file'));
          return;
        }
        resolve(data as FinFreeBackup);
      } catch {
        reject(new Error('Could not read file. Make sure it is a valid FinFree backup.'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

export async function importData(
  backup: FinFreeBackup,
  userId: string,
  mode: 'replace' | 'merge'
): Promise<void> {
  const storageMode = getStorageMode();
  const stamp = (arr: any[]) => arr.map(r => ({ ...r, user_id: userId }));

  if (storageMode === 'local') {
    if (mode === 'replace') {
      await Promise.all([
        localDb.accounts.where('user_id').equals(userId).delete(),
        localDb.transactions.where('user_id').equals(userId).delete(),
        localDb.investments.where('user_id').equals(userId).delete(),
        localDb.emis.where('user_id').equals(userId).delete(),
        localDb.goals.where('user_id').equals(userId).delete(),
      ]);
    }
    await Promise.all([
      backup.accounts.length && localDb.accounts.bulkPut(stamp(backup.accounts)),
      backup.transactions.length && localDb.transactions.bulkPut(stamp(backup.transactions)),
      backup.investments.length && localDb.investments.bulkPut(stamp(backup.investments)),
      backup.emis.length && localDb.emis.bulkPut(stamp(backup.emis)),
      backup.goals.length && localDb.goals.bulkPut(stamp(backup.goals)),
    ]);
    if (backup.profile) {
      await localDb.profiles.put({ ...backup.profile, id: userId });
    }
  } else {
    if (!supabase) throw new Error('Supabase not available');
    if (mode === 'replace') {
      await Promise.all([
        supabase.from('accounts').delete().eq('user_id', userId),
        supabase.from('transactions').delete().eq('user_id', userId),
        supabase.from('investments').delete().eq('user_id', userId),
        supabase.from('emis').delete().eq('user_id', userId),
        supabase.from('goals').delete().eq('user_id', userId),
      ]);
    }
    await Promise.all([
      backup.accounts.length && supabase.from('accounts').upsert(stamp(backup.accounts)),
      backup.transactions.length && supabase.from('transactions').upsert(stamp(backup.transactions)),
      backup.investments.length && supabase.from('investments').upsert(stamp(backup.investments)),
      backup.emis.length && supabase.from('emis').upsert(stamp(backup.emis)),
      backup.goals.length && supabase.from('goals').upsert(stamp(backup.goals)),
    ]);
  }
}
