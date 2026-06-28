/**
 * dataAdapter.ts — routes all CRUD operations to either
 * Dexie (local IndexedDB) or Supabase (cloud) based on storage mode.
 */
import { localDb } from './localdb';
import { supabase } from './db';
import { getStorageMode } from './storageMode';
import { v4 as uuidv4 } from 'uuid';

const isLocal = () => getStorageMode() === 'local';

// ─── ACCOUNTS ────────────────────────────────────────────────────────────────

export async function addAccount(data: any) {
  const record = { ...data, id: data.id || uuidv4() };
  if (isLocal()) {
    await localDb.accounts.put(record);
    return record;
  }
  const { data: d, error } = await supabase!.from('accounts').insert(record).select().single();
  if (error) throw error;
  return d;
}

export async function updateAccount(id: string, data: any) {
  if (isLocal()) {
    await localDb.accounts.update(id, data);
    return;
  }
  const { error } = await supabase!.from('accounts').update(data).eq('id', id);
  if (error) throw error;
}

export async function deleteAccount(id: string) {
  if (isLocal()) {
    await localDb.accounts.delete(id);
    return;
  }
  const { error } = await supabase!.from('accounts').delete().eq('id', id);
  if (error) throw error;
}

// ─── TRANSACTIONS ─────────────────────────────────────────────────────────────

export async function addTransaction(data: any) {
  const record = { ...data, id: data.id || uuidv4() };
  if (isLocal()) {
    await localDb.transactions.put(record);
    return record;
  }
  const { data: d, error } = await supabase!.from('transactions').insert(record).select().single();
  if (error) throw error;
  return d;
}

export async function updateTransaction(id: string, data: any) {
  if (isLocal()) {
    await localDb.transactions.update(id, data);
    return;
  }
  const { error } = await supabase!.from('transactions').update(data).eq('id', id);
  if (error) throw error;
}

export async function deleteTransaction(id: string) {
  if (isLocal()) {
    await localDb.transactions.delete(id);
    return;
  }
  const { error } = await supabase!.from('transactions').delete().eq('id', id);
  if (error) throw error;
}

// ─── INVESTMENTS ──────────────────────────────────────────────────────────────

export async function addInvestment(data: any) {
  const record = { ...data, id: data.id || uuidv4() };
  if (isLocal()) {
    await localDb.investments.put(record);
    return record;
  }
  const { data: d, error } = await supabase!.from('investments').insert(record).select().single();
  if (error) throw error;
  return d;
}

export async function updateInvestment(id: string, data: any) {
  if (isLocal()) {
    await localDb.investments.update(id, data);
    return;
  }
  const { error } = await supabase!.from('investments').update(data).eq('id', id);
  if (error) throw error;
}

export async function deleteInvestment(id: string) {
  if (isLocal()) {
    await localDb.investments.delete(id);
    return;
  }
  const { error } = await supabase!.from('investments').delete().eq('id', id);
  if (error) throw error;
}

// ─── EMIs ─────────────────────────────────────────────────────────────────────

export async function addEmi(data: any) {
  const record = { ...data, id: data.id || uuidv4() };
  if (isLocal()) {
    await localDb.emis.put(record);
    return record;
  }
  const { data: d, error } = await supabase!.from('emis').insert(record).select().single();
  if (error) throw error;
  return d;
}

export async function updateEmi(id: string, data: any) {
  if (isLocal()) {
    await localDb.emis.update(id, data);
    return;
  }
  const { error } = await supabase!.from('emis').update(data).eq('id', id);
  if (error) throw error;
}

export async function deleteEmi(id: string) {
  if (isLocal()) {
    await localDb.emis.delete(id);
    return;
  }
  const { error } = await supabase!.from('emis').delete().eq('id', id);
  if (error) throw error;
}

// ─── GOALS ────────────────────────────────────────────────────────────────────

export async function addGoal(data: any) {
  const record = { ...data, id: data.id || uuidv4() };
  if (isLocal()) {
    await localDb.goals.put(record);
    return record;
  }
  const { data: d, error } = await supabase!.from('goals').insert(record).select().single();
  if (error) throw error;
  return d;
}

export async function updateGoal(id: string, data: any) {
  if (isLocal()) {
    await localDb.goals.update(id, data);
    return;
  }
  const { error } = await supabase!.from('goals').update(data).eq('id', id);
  if (error) throw error;
}

export async function deleteGoal(id: string) {
  if (isLocal()) {
    await localDb.goals.delete(id);
    return;
  }
  const { error } = await supabase!.from('goals').delete().eq('id', id);
  if (error) throw error;
}
