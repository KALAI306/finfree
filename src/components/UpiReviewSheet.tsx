import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { categorizeByMerchant, getCategoryIcon } from '../lib/smsCategories';
import type { UpiTransaction } from '../lib/smsListener';
import { X, Check, ChevronDown } from 'lucide-react';

interface UpiReviewSheetProps {
  transaction: UpiTransaction | null;
  onSave: (tx: UpiTransaction & { account_id: string }) => void;
  onDismiss: () => void;
  queueCount?: number;
}

export const UpiReviewSheet: React.FC<UpiReviewSheetProps> = ({
  transaction,
  onSave,
  onDismiss,
  queueCount = 0,
}) => {
  const { accounts, fmt } = useApp();
  const [category, setCategory] = useState('');
  const [accountId, setAccountId] = useState('');
  const [note, setNote] = useState('');
  const [showCategories, setShowCategories] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const upiDefaultAccount = localStorage.getItem('finfree_upi_default_account') || '';

  useEffect(() => {
    if (!transaction) return;
    setCategory(transaction.category || categorizeByMerchant(transaction.merchant));
    setNote(transaction.rawNote);
    setAccountId(upiDefaultAccount || accounts[0]?.id || '');

    timerRef.current = setTimeout(() => {
      onDismiss();
    }, 30_000);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [transaction]);

  if (!transaction) return null;

  const CATEGORIES = [
    'Food', 'Fuel', 'Shopping', 'Entertainment', 'Healthcare',
    'Utilities', 'Transport', 'Rent', 'EMI', 'Education',
    'Investment', 'Miscellaneous',
  ];

  const handleSave = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    onSave({ ...transaction, category, rawNote: note, account_id: accountId });
  };

  const handleDismiss = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    onDismiss();
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-end justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={handleDismiss} />

      {/* Sheet */}
      <div className="relative w-full max-w-md bg-card border-t border-border rounded-t-2xl p-5 pb-8 animate-slide-up shadow-xl">
        {/* Handle */}
        <div className="w-10 h-1 bg-muted rounded-full mx-auto mb-4" />

        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">
              UPI {transaction.type === 'income' ? 'Received' : 'Payment'}
            </span>
            {queueCount > 0 && (
              <span className="text-xs text-muted-foreground">+{queueCount} more</span>
            )}
          </div>
          <button onClick={handleDismiss} className="p-1 rounded-lg hover:bg-accent cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Amount */}
        <p className={`text-3xl font-bold mb-4 ${transaction.type === 'income' ? 'text-emerald-500' : 'text-foreground'}`}>
          {transaction.type === 'income' ? '+' : '-'}{fmt(transaction.amount)}
        </p>

        {/* Merchant */}
        <p className="text-sm text-muted-foreground mb-4">{transaction.merchant}</p>

        {/* Category selector */}
        <div className="mb-3">
          <label className="text-xs text-muted-foreground mb-1 block">Category</label>
          <button
            onClick={() => setShowCategories(!showCategories)}
            className="w-full flex items-center justify-between p-3 rounded-xl border border-border hover:bg-accent transition-colors cursor-pointer"
          >
            <span>{getCategoryIcon(category)} {category}</span>
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          </button>
          {showCategories && (
            <div className="mt-1 grid grid-cols-3 gap-1 p-2 rounded-xl border border-border bg-card max-h-40 overflow-y-auto">
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => { setCategory(cat); setShowCategories(false); }}
                  className={`text-xs p-2 rounded-lg cursor-pointer transition-colors ${cat === category ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-accent'}`}
                >
                  {getCategoryIcon(cat)} {cat}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Account selector */}
        <div className="mb-3">
          <label className="text-xs text-muted-foreground mb-1 block">Account</label>
          <select
            value={accountId}
            onChange={e => setAccountId(e.target.value)}
            className="w-full p-3 rounded-xl border border-border bg-transparent text-sm cursor-pointer"
          >
            {accounts.map(acc => (
              <option key={acc.id} value={acc.id}>{acc.name}</option>
            ))}
          </select>
        </div>

        {/* Note */}
        <div className="mb-5">
          <label className="text-xs text-muted-foreground mb-1 block">Note</label>
          <input
            type="text"
            value={note}
            onChange={e => setNote(e.target.value)}
            className="w-full p-3 rounded-xl border border-border bg-transparent text-sm"
            placeholder="Add a note..."
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={handleDismiss}
            className="flex-1 p-3 rounded-xl border border-border text-sm font-medium hover:bg-accent transition-colors cursor-pointer"
          >
            Dismiss
          </button>
          <button
            onClick={handleSave}
            className="flex-1 p-3 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <Check className="w-4 h-4" /> Save
          </button>
        </div>
      </div>
    </div>
  );
};
