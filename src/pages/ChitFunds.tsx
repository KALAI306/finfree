import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { getChitFunds, addChitFund, getChitMembers, addChitMember, deleteChitFund } from '../lib/dataAdapter';
import { Plus, Users, Calendar, ChevronRight, Trash2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const ChitFunds: React.FC = () => {
  const { user, fmt, showToast } = useApp();
  const [chits, setChits] = useState<any[]>([]);
  const [filter, setFilter] = useState<'active' | 'completed' | 'all'>('active');
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState({
    name: '', total_value: '', total_members: '', frequency: 'monthly',
    frequency_days: '', start_date: new Date().toISOString().slice(0, 10),
    my_turn_number: '', commission_percent: '0', notes: '',
  });
  const [members, setMembers] = useState<{ name: string; phone: string }[]>([]);

  useEffect(() => { loadChits(); }, [user]);

  const loadChits = async () => {
    if (!user) return;
    setLoading(true);
    const data = await getChitFunds(user.id);
    setChits(data || []);
    setLoading(false);
  };

  const contribution = () => {
    const v = Number(form.total_value);
    const m = Number(form.total_members);
    return v && m ? v / m : 0;
  };

  const handleAdd = async () => {
    if (!form.name || !form.total_value || !form.total_members || !user) return;
    const chit = await addChitFund({
      user_id: user.id, name: form.name,
      total_value: Number(form.total_value),
      total_members: Number(form.total_members),
      monthly_contribution: contribution(),
      frequency: form.frequency,
      frequency_days: form.frequency === 'custom' ? Number(form.frequency_days) : null,
      start_date: form.start_date,
      my_turn_number: form.my_turn_number ? Number(form.my_turn_number) : null,
      commission_percent: Number(form.commission_percent),
      status: 'active', notes: form.notes,
    });
    for (let i = 0; i < members.length; i++) {
      if (!members[i].name) continue;
      await addChitMember({
        chit_id: chit.id, user_id: user.id,
        name: members[i].name, phone: members[i].phone,
        turn_number: i + 1, status: 'pending',
      });
    }
    showToast('Chit fund created', 'success');
    setShowForm(false);
    setForm({ name: '', total_value: '', total_members: '', frequency: 'monthly', frequency_days: '', start_date: new Date().toISOString().slice(0, 10), my_turn_number: '', commission_percent: '0', notes: '' });
    setMembers([]);
    loadChits();
  };

  const handleDelete = async (id: string) => {
    await deleteChitFund(id);
    showToast('Chit fund deleted', 'info');
    loadChits();
  };

  const filtered = chits.filter(c => filter === 'all' || c.status === filter);

  const getNextAlem = (chit: any) => {
    const start = new Date(chit.start_date);
    const now = new Date();
    let next = new Date(start);
    const interval = chit.frequency === 'monthly' ? 30 : chit.frequency === 'bimonthly' ? 60 : chit.frequency === 'quarterly' ? 90 : (chit.frequency_days || 30);
    while (next < now) next.setDate(next.getDate() + interval);
    return next;
  };

  const getRoundsCompleted = (chit: any) => {
    const start = new Date(chit.start_date);
    const now = new Date();
    const interval = chit.frequency === 'monthly' ? 30 : chit.frequency === 'bimonthly' ? 60 : chit.frequency === 'quarterly' ? 90 : (chit.frequency_days || 30);
    return Math.max(0, Math.floor((now.getTime() - start.getTime()) / (interval * 86400000)));
  };

  const handleMemberCountChange = (val: string) => {
    setForm(f => ({ ...f, total_members: val }));
    const count = Number(val);
    if (count > 0 && count <= 50) {
      setMembers(Array.from({ length: count }, (_, i) => members[i] || { name: '', phone: '' }));
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Chit Funds</h2>
          <p className="text-sm text-muted-foreground">Track your seettu / chit fund contributions</p>
        </div>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors cursor-pointer">
          <Plus className="w-4 h-4" /> New Chit
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {(['active', 'completed', 'all'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors cursor-pointer ${filter === f ? 'bg-primary text-primary-foreground' : 'bg-accent text-muted-foreground hover:text-foreground'}`}>
            {f}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Users className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground">No {filter === 'all' ? '' : filter} chit funds yet.</p>
          <p className="text-xs text-muted-foreground mt-1">Start tracking your seettu!</p>
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {filtered.map(chit => {
              const rounds = getRoundsCompleted(chit);
              const pct = Math.min(100, Math.round((rounds / chit.total_members) * 100));
              const next = getNextAlem(chit);
              return (
                <motion.div key={chit.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="glass-card rounded-2xl p-5 border border-border hover:border-primary/20 transition-colors">
                  <Link to={`/chits/${chit.id}`} className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-foreground truncate">{chit.name}</h3>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${chit.status === 'active' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-muted text-muted-foreground'}`}>
                          {chit.status}
                        </span>
                      </div>
                      <p className="text-lg font-bold text-foreground">{fmt(chit.total_value)}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {chit.total_members} members</span>
                        <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> Next: {next.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                      </div>
                      <div className="mt-2 w-full h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1">{rounds}/{chit.total_members} rounds · {fmt(chit.monthly_contribution)}/round</p>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <button onClick={e => { e.preventDefault(); handleDelete(chit.id); }} className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition-colors cursor-pointer">
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <ChevronRight className="w-5 h-5 text-muted-foreground" />
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Add Form Modal */}
      <AnimatePresence>
        {showForm && (
          <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40" onClick={() => setShowForm(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-lg bg-card border border-border rounded-2xl p-6 shadow-xl max-h-[85vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-lg font-semibold">New Chit Fund</h3>
                <button onClick={() => setShowForm(false)} className="p-1 rounded-lg hover:bg-accent cursor-pointer"><X className="w-4 h-4" /></button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Chit Name</label>
                  <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full bg-background border border-border rounded-xl py-2 px-3 text-sm" placeholder="e.g. Family Seettu 2026" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Total Value</label>
                    <input type="number" value={form.total_value} onChange={e => setForm(f => ({ ...f, total_value: e.target.value }))} className="w-full bg-background border border-border rounded-xl py-2 px-3 text-sm" placeholder="100000" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Members</label>
                    <input type="number" value={form.total_members} onChange={e => handleMemberCountChange(e.target.value)} className="w-full bg-background border border-border rounded-xl py-2 px-3 text-sm" placeholder="10" />
                  </div>
                </div>
                {contribution() > 0 && (
                  <p className="text-xs text-primary font-medium">Monthly contribution: {fmt(contribution())}</p>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Frequency</label>
                    <select value={form.frequency} onChange={e => setForm(f => ({ ...f, frequency: e.target.value }))} className="w-full bg-background border border-border rounded-xl py-2 px-3 text-sm">
                      <option value="monthly">Monthly</option>
                      <option value="bimonthly">Every 2 Months</option>
                      <option value="quarterly">Quarterly</option>
                      <option value="custom">Custom</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Start Date</label>
                    <input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} className="w-full bg-background border border-border rounded-xl py-2 px-3 text-sm" />
                  </div>
                </div>
                {form.frequency === 'custom' && (
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Interval (days)</label>
                    <input type="number" value={form.frequency_days} onChange={e => setForm(f => ({ ...f, frequency_days: e.target.value }))} className="w-full bg-background border border-border rounded-xl py-2 px-3 text-sm" placeholder="45" />
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">My Turn #</label>
                    <input type="number" value={form.my_turn_number} onChange={e => setForm(f => ({ ...f, my_turn_number: e.target.value }))} className="w-full bg-background border border-border rounded-xl py-2 px-3 text-sm" placeholder="Optional" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Commission %</label>
                    <input type="number" value={form.commission_percent} onChange={e => setForm(f => ({ ...f, commission_percent: e.target.value }))} className="w-full bg-background border border-border rounded-xl py-2 px-3 text-sm" />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Notes</label>
                  <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="w-full bg-background border border-border rounded-xl py-2 px-3 text-sm" placeholder="Optional" />
                </div>

                {members.length > 0 && (
                  <div>
                    <label className="text-xs text-muted-foreground block mb-2">Members</label>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {members.map((m, i) => (
                        <div key={i} className="flex gap-2">
                          <span className="text-xs text-muted-foreground w-6 pt-2.5 text-right">{i + 1}.</span>
                          <input value={m.name} onChange={e => { const arr = [...members]; arr[i] = { ...arr[i], name: e.target.value }; setMembers(arr); }} className="flex-1 bg-background border border-border rounded-lg py-1.5 px-2 text-sm" placeholder="Name" />
                          <input value={m.phone} onChange={e => { const arr = [...members]; arr[i] = { ...arr[i], phone: e.target.value }; setMembers(arr); }} className="w-32 bg-background border border-border rounded-lg py-1.5 px-2 text-sm" placeholder="Phone" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <button onClick={handleAdd} disabled={!form.name || !form.total_value || !form.total_members} className="w-full py-2.5 bg-primary text-primary-foreground rounded-xl font-medium text-sm hover:bg-primary/90 transition-colors disabled:opacity-50 cursor-pointer mt-2">
                  Create Chit Fund
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
