import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { getLendings, addLending, deleteLending } from '../lib/dataAdapter';
import { Plus, ArrowUpRight, ArrowDownLeft, ChevronRight, Trash2, X, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const Lending: React.FC = () => {
  const { user, fmt, showToast } = useApp();
  const [records, setRecords] = useState<any[]>([]);
  const [tab, setTab] = useState<'lent' | 'borrowed'>('lent');
  const [filter, setFilter] = useState<'all' | 'active' | 'overdue' | 'settled'>('all');
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState({
    type: 'lent' as 'lent' | 'borrowed',
    person_name: '', person_phone: '', amount: '',
    lent_date: new Date().toISOString().slice(0, 10),
    due_date: '', reason: '', notes: '',
  });

  useEffect(() => { load(); }, [user]);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    setRecords(await getLendings(user.id) || []);
    setLoading(false);
  };

  const handleAdd = async () => {
    if (!form.person_name || !form.amount || !user) return;
    await addLending({
      user_id: user.id, type: form.type,
      person_name: form.person_name, person_phone: form.person_phone,
      amount: Number(form.amount), remaining_amount: Number(form.amount),
      reason: form.reason, lent_date: form.lent_date,
      due_date: form.due_date || null, notes: form.notes, status: 'active',
    });
    showToast(`${form.type === 'lent' ? 'Lending' : 'Borrowing'} recorded`, 'success');
    setShowForm(false);
    setForm({ type: 'lent', person_name: '', person_phone: '', amount: '', lent_date: new Date().toISOString().slice(0, 10), due_date: '', reason: '', notes: '' });
    load();
  };

  const handleDelete = async (id: string) => {
    await deleteLending(id);
    showToast('Record deleted', 'info');
    load();
  };

  const isOverdue = (r: any) => r.due_date && r.status === 'active' && new Date(r.due_date) < new Date();

  const tabRecords = records.filter(r => r.type === tab);
  const filtered = tabRecords.filter(r => {
    if (filter === 'all') return true;
    if (filter === 'overdue') return isOverdue(r);
    if (filter === 'settled') return r.status === 'settled' || r.status === 'written_off';
    return r.status === 'active' || r.status === 'partially_paid';
  });

  const totalLent = records.filter(r => r.type === 'lent' && r.status !== 'settled' && r.status !== 'written_off').reduce((s, r) => s + Number(r.remaining_amount), 0);
  const totalBorrowed = records.filter(r => r.type === 'borrowed' && r.status !== 'settled' && r.status !== 'written_off').reduce((s, r) => s + Number(r.remaining_amount), 0);
  const lentPeople = new Set(records.filter(r => r.type === 'lent' && r.status === 'active').map(r => r.person_name)).size;
  const borrowedPeople = new Set(records.filter(r => r.type === 'borrowed' && r.status === 'active').map(r => r.person_name)).size;

  const daysSince = (dateStr: string) => Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
  const daysUntil = (dateStr: string) => Math.floor((new Date(dateStr).getTime() - Date.now()) / 86400000);

  const getStatusBadge = (r: any) => {
    if (r.status === 'settled') return { cls: 'bg-emerald-500/10 text-emerald-500', text: 'Settled' };
    if (r.status === 'written_off') return { cls: 'bg-muted text-muted-foreground', text: 'Written Off' };
    if (r.status === 'partially_paid') return { cls: 'bg-amber-500/10 text-amber-500', text: 'Partial' };
    if (isOverdue(r)) return { cls: 'bg-red-500/10 text-red-500', text: 'Overdue' };
    return { cls: 'bg-blue-500/10 text-blue-500', text: 'Active' };
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Lent & Borrowed</h2>
          <p className="text-sm text-muted-foreground">Track money owed to you and by you</p>
        </div>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors cursor-pointer">
          <Plus className="w-4 h-4" /> Add
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="glass-card rounded-xl p-4 border border-border">
          <div className="flex items-center gap-2 mb-1">
            <ArrowUpRight className="w-4 h-4 text-emerald-500" />
            <p className="text-xs text-muted-foreground">I Lent (owed to me)</p>
          </div>
          <p className="text-xl font-bold text-emerald-500">{fmt(totalLent)}</p>
          <p className="text-[10px] text-muted-foreground">{lentPeople} {lentPeople === 1 ? 'person' : 'people'}</p>
        </div>
        <div className="glass-card rounded-xl p-4 border border-border">
          <div className="flex items-center gap-2 mb-1">
            <ArrowDownLeft className="w-4 h-4 text-red-500" />
            <p className="text-xs text-muted-foreground">I Borrowed (I owe)</p>
          </div>
          <p className="text-xl font-bold text-red-500">{fmt(totalBorrowed)}</p>
          <p className="text-[10px] text-muted-foreground">{borrowedPeople} {borrowedPeople === 1 ? 'person' : 'people'}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-accent/50 rounded-xl p-1">
        <button onClick={() => setTab('lent')} className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${tab === 'lent' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}>
          I Lent
        </button>
        <button onClick={() => setTab('borrowed')} className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${tab === 'borrowed' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}>
          I Borrowed
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {(['all', 'active', 'overdue', 'settled'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors cursor-pointer ${filter === f ? 'bg-primary text-primary-foreground' : 'bg-accent text-muted-foreground'}`}>
            {f}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <ArrowUpRight className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground">No {filter === 'all' ? '' : filter} records</p>
        </div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence>
            {filtered.map(r => {
              const badge = getStatusBadge(r);
              return (
                <motion.div key={r.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="glass-card rounded-xl p-4 border border-border hover:border-primary/20 transition-colors">
                  <Link to={`/lending/${r.id}`} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                        {r.person_name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{r.person_name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${badge.cls}`}>{badge.text}</span>
                          <span className="text-[10px] text-muted-foreground">
                            {r.due_date ? (daysUntil(r.due_date) >= 0 ? `${daysUntil(r.due_date)}d left` : `${Math.abs(daysUntil(r.due_date))}d overdue`) : `${daysSince(r.lent_date)}d ago`}
                          </span>
                        </div>
                        {r.reason && <p className="text-[10px] text-muted-foreground mt-0.5">{r.reason}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <p className="text-sm font-bold">{fmt(r.remaining_amount)}</p>
                        {r.remaining_amount < r.amount && <p className="text-[10px] text-muted-foreground">of {fmt(r.amount)}</p>}
                      </div>
                      <button onClick={e => { e.preventDefault(); handleDelete(r.id); }} className="p-1 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-500 cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Add Form */}
      <AnimatePresence>
        {showForm && (
          <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40" onClick={() => setShowForm(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-md bg-card border border-border rounded-2xl p-6 shadow-xl">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-lg font-semibold">Record Money</h3>
                <button onClick={() => setShowForm(false)} className="p-1 rounded-lg hover:bg-accent cursor-pointer"><X className="w-4 h-4" /></button>
              </div>
              <div className="space-y-3">
                <div className="flex gap-1 bg-accent/50 rounded-xl p-1">
                  <button onClick={() => setForm(f => ({ ...f, type: 'lent' }))} className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${form.type === 'lent' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}>I Lent Money</button>
                  <button onClick={() => setForm(f => ({ ...f, type: 'borrowed' }))} className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${form.type === 'borrowed' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}>I Borrowed Money</button>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Person Name</label>
                  <input value={form.person_name} onChange={e => setForm(f => ({ ...f, person_name: e.target.value }))} className="w-full bg-background border border-border rounded-xl py-2 px-3 text-sm" placeholder="Name" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Phone (optional)</label>
                  <input value={form.person_phone} onChange={e => setForm(f => ({ ...f, person_phone: e.target.value }))} className="w-full bg-background border border-border rounded-xl py-2 px-3 text-sm" placeholder="+91..." />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Amount</label>
                  <input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} className="w-full bg-background border border-border rounded-xl py-2 px-3 text-sm" placeholder="5000" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Date</label>
                    <input type="date" value={form.lent_date} onChange={e => setForm(f => ({ ...f, lent_date: e.target.value }))} className="w-full bg-background border border-border rounded-xl py-2 px-3 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Due Date</label>
                    <input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} className="w-full bg-background border border-border rounded-xl py-2 px-3 text-sm" />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Reason</label>
                  <input value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} className="w-full bg-background border border-border rounded-xl py-2 px-3 text-sm" placeholder="Medical emergency, house repair, etc." />
                </div>
                <button onClick={handleAdd} disabled={!form.person_name || !form.amount} className="w-full py-2.5 bg-primary text-primary-foreground rounded-xl font-medium text-sm disabled:opacity-50 cursor-pointer mt-2">
                  Save Record
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
