import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { getChitFunds, getChitMembers, getChitPayments, updateChitMember, addChitPayment, updateChitPayment } from '../lib/dataAdapter';
import { ArrowLeft, Users, Calendar, Receipt, BarChart3, Check, Clock, Plus, X } from 'lucide-react';
import { motion } from 'framer-motion';

export const ChitFundDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user, fmt, showToast } = useApp();
  const [chit, setChit] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [tab, setTab] = useState<'members' | 'payments' | 'summary'>('members');
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentForm, setPaymentForm] = useState({ round_number: '', alem_date: new Date().toISOString().slice(0, 10), amount_paid: '', notes: '' });

  useEffect(() => { load(); }, [id, user]);

  const load = async () => {
    if (!id || !user) return;
    const chits = await getChitFunds(user.id);
    const c = chits.find((x: any) => x.id === id);
    if (c) setChit(c);
    setMembers(await getChitMembers(id));
    setPayments(await getChitPayments(id));
  };

  const markCollected = async (memberId: string, amount: number) => {
    await updateChitMember(memberId, { status: 'collected', collected_amount: amount, collection_date: new Date().toISOString().slice(0, 10) });
    showToast('Member marked as collected', 'success');
    load();
  };

  const handleAddPayment = async () => {
    if (!id || !user || !paymentForm.round_number || !paymentForm.amount_paid) return;
    await addChitPayment({
      chit_id: id, user_id: user.id,
      round_number: Number(paymentForm.round_number),
      alem_date: paymentForm.alem_date,
      amount_paid: Number(paymentForm.amount_paid),
      payment_status: 'paid', notes: paymentForm.notes,
    });
    showToast('Payment recorded', 'success');
    setShowPaymentForm(false);
    setPaymentForm({ round_number: '', alem_date: new Date().toISOString().slice(0, 10), amount_paid: '', notes: '' });
    load();
  };

  if (!chit) return <div className="max-w-4xl mx-auto px-4 py-6 text-muted-foreground">Loading...</div>;

  const collected = members.filter(m => m.status === 'collected').length;
  const myContributed = payments.filter(p => p.payment_status === 'paid').reduce((s: number, p: any) => s + Number(p.amount_paid), 0);
  const myCollected = chit.my_turn_number && members.find((m: any) => m.turn_number === chit.my_turn_number && m.status === 'collected')
    ? Number(members.find((m: any) => m.turn_number === chit.my_turn_number)?.collected_amount || 0) : 0;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      <Link to="/chits" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Chit Funds
      </Link>

      {/* Hero */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-2xl p-6 border border-border">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold">{chit.name}</h2>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${chit.status === 'active' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-muted text-muted-foreground'}`}>{chit.status}</span>
          </div>
          <p className="text-2xl font-bold">{fmt(chit.total_value)}</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-accent/50 rounded-xl p-3 text-center">
            <p className="text-xs text-muted-foreground">Members</p>
            <p className="text-lg font-bold">{chit.total_members}</p>
          </div>
          <div className="bg-accent/50 rounded-xl p-3 text-center">
            <p className="text-xs text-muted-foreground">Contribution</p>
            <p className="text-lg font-bold">{fmt(chit.monthly_contribution)}</p>
          </div>
          <div className="bg-accent/50 rounded-xl p-3 text-center">
            <p className="text-xs text-muted-foreground">Collected</p>
            <p className="text-lg font-bold">{collected}/{chit.total_members}</p>
          </div>
          <div className="bg-accent/50 rounded-xl p-3 text-center">
            <p className="text-xs text-muted-foreground">My Turn</p>
            <p className="text-lg font-bold">{chit.my_turn_number || '—'}</p>
          </div>
        </div>
      </motion.div>

      {/* Tabs */}
      <div className="flex gap-1 bg-accent/50 rounded-xl p-1">
        {([['members', Users, 'Members'], ['payments', Receipt, 'Payments'], ['summary', BarChart3, 'Summary']] as const).map(([key, Icon, label]) => (
          <button key={key} onClick={() => setTab(key)} className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${tab === key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}>
            <Icon className="w-3.5 h-3.5" /> {label}
          </button>
        ))}
      </div>

      {/* Members Tab */}
      {tab === 'members' && (
        <div className="space-y-2">
          {members.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No members added yet</p>
          ) : members.map(m => (
            <div key={m.id} className="glass-card rounded-xl p-4 border border-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                  {m.turn_number}
                </div>
                <div>
                  <p className="text-sm font-medium">{m.name}</p>
                  {m.phone && <p className="text-xs text-muted-foreground">{m.phone}</p>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {m.status === 'collected' ? (
                  <span className="flex items-center gap-1 text-xs text-emerald-500 font-medium">
                    <Check className="w-3.5 h-3.5" /> {fmt(m.collected_amount)}
                  </span>
                ) : (
                  <button onClick={() => markCollected(m.id, chit.total_value)} className="px-3 py-1.5 text-xs bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors cursor-pointer">
                    Mark Collected
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Payments Tab */}
      {tab === 'payments' && (
        <div className="space-y-3">
          <button onClick={() => setShowPaymentForm(true)} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors cursor-pointer">
            <Plus className="w-4 h-4" /> Record Payment
          </button>
          {payments.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No payments recorded yet</p>
          ) : payments.map(p => (
            <div key={p.id} className="glass-card rounded-xl p-4 border border-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-xs font-bold text-muted-foreground">
                    R{p.round_number}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{fmt(p.amount_paid)}</p>
                    <p className="text-xs text-muted-foreground">{new Date(p.alem_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                  </div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${p.payment_status === 'paid' ? 'bg-emerald-500/10 text-emerald-500' : p.payment_status === 'defaulted' ? 'bg-red-500/10 text-red-500' : 'bg-amber-500/10 text-amber-500'}`}>
                  {p.payment_status}
                </span>
              </div>
              {p.notes && <p className="text-xs text-muted-foreground mt-2">{p.notes}</p>}
            </div>
          ))}

          {showPaymentForm && (
            <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/40" onClick={() => setShowPaymentForm(false)} />
              <div className="relative w-full max-w-sm bg-card border border-border rounded-2xl p-6 shadow-xl">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold">Record Payment</h3>
                  <button onClick={() => setShowPaymentForm(false)} className="p-1 rounded-lg hover:bg-accent cursor-pointer"><X className="w-4 h-4" /></button>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Round #</label>
                    <input type="number" value={paymentForm.round_number} onChange={e => setPaymentForm(f => ({ ...f, round_number: e.target.value }))} className="w-full bg-background border border-border rounded-xl py-2 px-3 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Date</label>
                    <input type="date" value={paymentForm.alem_date} onChange={e => setPaymentForm(f => ({ ...f, alem_date: e.target.value }))} className="w-full bg-background border border-border rounded-xl py-2 px-3 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Amount</label>
                    <input type="number" value={paymentForm.amount_paid} onChange={e => setPaymentForm(f => ({ ...f, amount_paid: e.target.value }))} className="w-full bg-background border border-border rounded-xl py-2 px-3 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Notes</label>
                    <input value={paymentForm.notes} onChange={e => setPaymentForm(f => ({ ...f, notes: e.target.value }))} className="w-full bg-background border border-border rounded-xl py-2 px-3 text-sm" placeholder="Auction details, etc." />
                  </div>
                  <button onClick={handleAddPayment} disabled={!paymentForm.round_number || !paymentForm.amount_paid} className="w-full py-2.5 bg-primary text-primary-foreground rounded-xl font-medium text-sm disabled:opacity-50 cursor-pointer">
                    Save Payment
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Summary Tab */}
      {tab === 'summary' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="glass-card rounded-xl p-5 border border-border text-center">
            <p className="text-xs text-muted-foreground mb-1">Total Contributed by Me</p>
            <p className="text-2xl font-bold">{fmt(myContributed)}</p>
          </div>
          <div className="glass-card rounded-xl p-5 border border-border text-center">
            <p className="text-xs text-muted-foreground mb-1">Total Collected by Me</p>
            <p className="text-2xl font-bold text-emerald-500">{fmt(myCollected)}</p>
          </div>
          <div className="glass-card rounded-xl p-5 border border-border text-center">
            <p className="text-xs text-muted-foreground mb-1">Net Position</p>
            <p className={`text-2xl font-bold ${myCollected - myContributed >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
              {myCollected - myContributed >= 0 ? '+' : ''}{fmt(myCollected - myContributed)}
            </p>
          </div>
          <div className="glass-card rounded-xl p-5 border border-border text-center">
            <p className="text-xs text-muted-foreground mb-1">Rounds Remaining</p>
            <p className="text-2xl font-bold">{chit.total_members - collected}</p>
          </div>
        </div>
      )}
    </div>
  );
};
