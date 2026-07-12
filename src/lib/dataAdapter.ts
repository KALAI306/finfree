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

export async function bulkAddTransactions(items: any[]) {
  const records = items.map(d => ({ ...d, id: d.id || uuidv4() }));
  if (isLocal()) {
    await localDb.transactions.bulkPut(records);
    return records;
  }
  const { data: d, error } = await supabase!.from('transactions').insert(records).select();
  if (error) throw error;
  return d;
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

// ─── CHIT FUNDS ──────────────────────────────────────────────────────────────

export async function getChitFunds(userId: string) {
  if (isLocal()) return (await localDb.chit_funds.where('user_id').equals(userId).toArray());
  const { data, error } = await supabase!.from('chit_funds').select('*').eq('user_id', userId).order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function addChitFund(data: any) {
  const record = { ...data, id: data.id || uuidv4() };
  if (isLocal()) { await localDb.chit_funds.put(record); return record; }
  const { data: d, error } = await supabase!.from('chit_funds').insert(record).select().single();
  if (error) throw error;
  return d;
}

export async function updateChitFund(id: string, data: any) {
  if (isLocal()) { await localDb.chit_funds.update(id, data); return; }
  const { error } = await supabase!.from('chit_funds').update(data).eq('id', id);
  if (error) throw error;
}

export async function deleteChitFund(id: string) {
  if (isLocal()) { await localDb.chit_funds.delete(id); return; }
  const { error } = await supabase!.from('chit_funds').delete().eq('id', id);
  if (error) throw error;
}

export async function getChitMembers(chitId: string) {
  if (isLocal()) return (await localDb.chit_members.where('chit_id').equals(chitId).toArray());
  const { data, error } = await supabase!.from('chit_members').select('*').eq('chit_id', chitId).order('turn_number');
  if (error) throw error;
  return data;
}

export async function addChitMember(data: any) {
  const record = { ...data, id: data.id || uuidv4() };
  if (isLocal()) { await localDb.chit_members.put(record); return record; }
  const { data: d, error } = await supabase!.from('chit_members').insert(record).select().single();
  if (error) throw error;
  return d;
}

export async function updateChitMember(id: string, data: any) {
  if (isLocal()) { await localDb.chit_members.update(id, data); return; }
  const { error } = await supabase!.from('chit_members').update(data).eq('id', id);
  if (error) throw error;
}

export async function getChitPayments(chitId: string) {
  if (isLocal()) return (await localDb.chit_payments.where('chit_id').equals(chitId).toArray());
  const { data, error } = await supabase!.from('chit_payments').select('*').eq('chit_id', chitId).order('round_number');
  if (error) throw error;
  return data;
}

export async function addChitPayment(data: any) {
  const record = { ...data, id: data.id || uuidv4() };
  if (isLocal()) { await localDb.chit_payments.put(record); return record; }
  const { data: d, error } = await supabase!.from('chit_payments').insert(record).select().single();
  if (error) throw error;
  return d;
}

export async function updateChitPayment(id: string, data: any) {
  if (isLocal()) { await localDb.chit_payments.update(id, data); return; }
  const { error } = await supabase!.from('chit_payments').update(data).eq('id', id);
  if (error) throw error;
}

// ─── MONEY LENDING ───────────────────────────────────────────────────────────

export async function getLendings(userId: string) {
  if (isLocal()) return (await localDb.money_lending.where('user_id').equals(userId).toArray());
  const { data, error } = await supabase!.from('money_lending').select('*').eq('user_id', userId).order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function addLending(data: any) {
  const record = { ...data, id: data.id || uuidv4() };
  if (isLocal()) { await localDb.money_lending.put(record); return record; }
  const { data: d, error } = await supabase!.from('money_lending').insert(record).select().single();
  if (error) throw error;
  return d;
}

export async function updateLending(id: string, data: any) {
  if (isLocal()) { await localDb.money_lending.update(id, data); return; }
  const { error } = await supabase!.from('money_lending').update(data).eq('id', id);
  if (error) throw error;
}

export async function deleteLending(id: string) {
  if (isLocal()) { await localDb.money_lending.delete(id); return; }
  const { error } = await supabase!.from('money_lending').delete().eq('id', id);
  if (error) throw error;
}

export async function getLendingPayments(lendingId: string) {
  if (isLocal()) return (await localDb.lending_payments.where('lending_id').equals(lendingId).toArray());
  const { data, error } = await supabase!.from('lending_payments').select('*').eq('lending_id', lendingId).order('payment_date');
  if (error) throw error;
  return data;
}

export async function addLendingPayment(data: any) {
  const record = { ...data, id: data.id || uuidv4() };
  if (isLocal()) { await localDb.lending_payments.put(record); return record; }
  const { data: d, error } = await supabase!.from('lending_payments').insert(record).select().single();
  if (error) throw error;
  return d;
}
