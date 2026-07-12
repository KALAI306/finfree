import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { getLendings, getLendingPayments, addLendingPayment, updateLending } from '../lib/dataAdapter';
import { ArrowLeft, Plus, X, Check, Ban, MessageCircle, Clock } from 'lucide-react';
import { motion } from 'framer-motion';
import { Capacitor } from '@capacitor/core';

export const LendingDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user, fmt, showToast } = useApp();
  const [record, setRecord] = useState<any>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [showPayment, setShowPayment] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10));
  const [payNotes, setPayNotes] = useState('');

  useEffect(() => { load(); }, [id, user]);

  const load = async () => {
    if (!id || !user) return;
    const all = await getLendings(user.id);
    const r = all.find((x: any) => x.id === id);
    if (r) setRecord(r);
    setPayments(await getLendingPayments(id));
  };

  const handleRecordPayment = async () => {
    if (!id || !user || !payAmount) return;
    const amt = Number(payAmount);
    await addLendingPayment({ lending_id: id, user_id: user.id, amount: amt, payment_date: payDate, notes: payNotes });

    const newRemaining = Math.max(0, record.remaining_amount - amt);
    const newStatus = newRemaining <= 0 ? 'settled' : 'partially_paid';
    await updateLending(id, { remaining_amount: newRemaining, status: newStatus });

    showToast(newStatus === 'settled' ? 'Fully settled!' : `Payment of ${fmt(amt)} recorded`, 'success');
    setShowPayment(false);
    setPayAmount('');
    setPayNotes('');
    load();
  };

  const handleSettle = async () => {
    if (!id) return;
    await updateLending(id, { remaining_amount: 0, status: 'settled' });
    showToast('Marked as settled', 'success');
    load();
  };

  const handleWriteOff = async () => {
    if (!id) return;
    await updateLending(id, { status: 'written_off' });
    showToast('Written off', 'info');
    load();
  };

  const openWhatsApp = () => {
    if (!record) return;
    const phone = record.person_phone?.replace(/[^0-9]/g, '') || '';
    const msg = encodeURIComponent(
      `Hi ${record.person_name}, just a reminder about the ₹${record.remaining_amount.toLocaleString()} you borrowed on ${new Date(record.lent_date).toLocaleDateString('en-IN')}. Let me know when convenient 🙏`
    );
    const url = phone ? `https://wa.me/${phone}?text=${msg}` : `https://wa.me/?text=${msg}`;
    window.open(url, '_blank');
  };

  if (!record) return <div className="max-w-4xl mx-auto px-4 py-6 text-muted-foreground">Loading...</div>;

  const paidSoFar = payments.reduce((s, p) => s + Number(p.amount), 0);
  const pctPaid = record.amount > 0 ? Math.round((paidSoFar / record.amount) * 100) : 0;
  const isOverdue = record.due_date && record.status === 'active' && new Date(record.due_date) < new Date();
  const daysSince = Math.floor((Date.now() - new Date(record.lent_date).getTime()) / 86400000);

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      <Link to="/lending" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back
      </Link>

      {/* Hero */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-2xl p-6 border border-border">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-lg font-bold text-primary">
              {record.person_name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="text-xl font-bold">{record.person_name}</h2>
              <p className="text-xs text-muted-foreground">
                {record.type === 'lent' ? 'You lent' : 'You borrowed'} · {daysSince} days ago
              </p>
            </div>
          </div>
          {isOverdue && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/10 text-red-500 font-medium">Overdue</span>
          )}
        </div>

        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Original</p>
            <p className="text-lg font-bold">{fmt(record.amount)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Paid</p>
            <p className="text-lg font-bold text-emerald-500">{fmt(paidSoFar)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Remaining</p>
            <p className="text-lg font-bold text-red-500">{fmt(record.remaining_amount)}</p>
          </div>
        </div>

        {/* Progress */}
        <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${pctPaid}%` }} />
        </div>
        <p className="text-[10px] text-muted-foreground mt-1 text-right">{pctPaid}% paid</p>

        {record.reason && <p className="text-xs text-muted-foreground mt-2">Reason: {record.reason}</p>}
        {record.due_date && <p className="text-xs text-muted-foreground">Due: {new Date(record.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>}
      </motion.div>

      {/* Actions */}
      {record.status !== 'settled' && record.status !== 'written_off' && (
        <div className="flex gap-2">
          <button onClick={() => setShowPayment(true)} className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium cursor-pointer">
            <Plus className="w-4 h-4" /> Record Payment
          </button>
          {record.type === 'lent' && (
            <button onClick={openWhatsApp} className="flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-medium cursor-pointer">
              <MessageCircle className="w-4 h-4" /> Remind
            </button>
          )}
        </div>
      )}

      {record.status !== 'settled' && record.status !== 'written_off' && (
        <div className="flex gap-2">
          <button onClick={handleSettle} className="flex-1 flex items-center justify-center gap-2 py-2 border border-border rounded-xl text-xs font-medium text-muted-foreground hover:text-foreground cursor-pointer">
            <Check className="w-3.5 h-3.5" /> Mark Settled
          </button>
          <button onClick={handleWriteOff} className="flex-1 flex items-center justify-center gap-2 py-2 border border-border rounded-xl text-xs font-medium text-muted-foreground hover:text-red-500 cursor-pointer">
            <Ban className="w-3.5 h-3.5" /> Write Off
          </button>
        </div>
      )}

      {/* Payment Timeline */}
      <div>
        <h3 className="text-sm font-semibold mb-3">Payment History</h3>
        {payments.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">No payments recorded yet</p>
        ) : (
          <div className="space-y-2">
            {payments.map(p => (
              <div key={p.id} className="flex items-center gap-3 glass-card rounded-xl p-3 border border-border">
                <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center">
                  <Check className="w-4 h-4 text-emerald-500" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{fmt(p.amount)}</p>
                  <p className="text-xs text-muted-foreground">{new Date(p.payment_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                </div>
                {p.notes && <p className="text-xs text-muted-foreground">{p.notes}</p>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Payment Form */}
      {showPayment && (
        <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowPayment(false)} />
          <div className="relative w-full max-w-sm bg-card border border-border rounded-2xl p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Record Payment</h3>
              <button onClick={() => setShowPayment(false)} className="p-1 rounded-lg hover:bg-accent cursor-pointer"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Amount</label>
                <input type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)} className="w-full bg-background border border-border rounded-xl py-2 px-3 text-sm" placeholder={`Max: ${record.remaining_amount}`} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Date</label>
                <input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} className="w-full bg-background border border-border rounded-xl py-2 px-3 text-sm" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Notes</label>
                <input value={payNotes} onChange={e => setPayNotes(e.target.value)} className="w-full bg-background border border-border rounded-xl py-2 px-3 text-sm" placeholder="Optional" />
              </div>
              <button onClick={handleRecordPayment} disabled={!payAmount} className="w-full py-2.5 bg-primary text-primary-foreground rounded-xl font-medium text-sm disabled:opacity-50 cursor-pointer">
                Save Payment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
