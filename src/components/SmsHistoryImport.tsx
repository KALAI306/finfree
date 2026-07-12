import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { readSmsHistory, isDuplicate, type UpiTransaction } from '../lib/smsListener';
import { getCategoryIcon } from '../lib/smsCategories';
import { bulkAddTransactions } from '../lib/dataAdapter';
import { Smartphone, Check, X, Loader2 } from 'lucide-react';

interface SmsHistoryImportProps {
  onClose: () => void;
}

export const SmsHistoryImport: React.FC<SmsHistoryImportProps> = ({ onClose }) => {
  const { accounts, transactions, fmt, showToast } = useApp();
  const [step, setStep] = useState<'idle' | 'scanning' | 'review' | 'importing'>('idle');
  const [found, setFound] = useState<(UpiTransaction & { selected: boolean })[]>([]);
  const [progress, setProgress] = useState(0);

  const defaultAccount = localStorage.getItem('finfree_upi_default_account') || accounts[0]?.id || '';

  const handleScan = async () => {
    setStep('scanning');
    const txs = await readSmsHistory(90);

    const existingNotes = transactions.map((t: any) => t.note || t.description || '');
    const fresh = txs.filter(tx => !isDuplicate(tx.upiRef, existingNotes));

    setFound(fresh.map(tx => ({ ...tx, selected: true })));
    setStep('review');
  };

  const toggleItem = (idx: number) => {
    setFound(prev => prev.map((item, i) => i === idx ? { ...item, selected: !item.selected } : item));
  };

  const handleImport = async () => {
    const selected = found.filter(f => f.selected);
    if (!selected.length) return;

    setStep('importing');
    const records = selected.map(tx => ({
      amount: tx.amount,
      type: tx.type,
      category: tx.category,
      description: tx.merchant,
      note: tx.rawNote,
      date: tx.date,
      account_id: defaultAccount,
    }));

    const batchSize = 50;
    for (let i = 0; i < records.length; i += batchSize) {
      await bulkAddTransactions(records.slice(i, i + batchSize));
      setProgress(Math.min(100, Math.round(((i + batchSize) / records.length) * 100)));
    }

    showToast(`Imported ${selected.length} transactions`, 'success');
    onClose();
  };

  const selectedCount = found.filter(f => f.selected).length;

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-card border border-border rounded-2xl p-6 shadow-xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold">Import SMS History</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-accent cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {step === 'idle' && (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground mb-4">
              Scan your SMS inbox for UPI transactions from the last 90 days.
              Duplicates will be automatically filtered out.
            </p>
            <button
              onClick={handleScan}
              className="px-6 py-3 bg-primary text-primary-foreground rounded-xl font-medium hover:bg-primary/90 transition-colors cursor-pointer"
            >
              Start Scanning
            </button>
          </div>
        )}

        {step === 'scanning' && (
          <div className="text-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Scanning SMS messages...</p>
          </div>
        )}

        {step === 'review' && (
          <>
            <p className="text-sm text-muted-foreground mb-3">
              Found {found.length} new transactions. Deselect any you don't want to import.
            </p>
            <div className="flex-1 overflow-y-auto space-y-2 mb-4 min-h-0">
              {found.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No new transactions found.</p>
              ) : (
                found.map((tx, idx) => (
                  <button
                    key={idx}
                    onClick={() => toggleItem(idx)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-colors cursor-pointer ${
                      tx.selected ? 'border-primary/30 bg-primary/5' : 'border-border opacity-50'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded border flex items-center justify-center ${
                      tx.selected ? 'bg-primary border-primary' : 'border-muted-foreground'
                    }`}>
                      {tx.selected && <Check className="w-3 h-3 text-primary-foreground" />}
                    </div>
                    <span className="text-lg">{getCategoryIcon(tx.category)}</span>
                    <div className="flex-1 text-left">
                      <p className="text-sm font-medium truncate">{tx.merchant}</p>
                      <p className="text-xs text-muted-foreground">{tx.date}</p>
                    </div>
                    <span className={`text-sm font-semibold ${tx.type === 'income' ? 'text-emerald-500' : ''}`}>
                      {tx.type === 'income' ? '+' : '-'}{fmt(tx.amount)}
                    </span>
                  </button>
                ))
              )}
            </div>
            {found.length > 0 && (
              <button
                onClick={handleImport}
                disabled={selectedCount === 0}
                className="w-full p-3 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 cursor-pointer"
              >
                Import {selectedCount} Transactions
              </button>
            )}
          </>
        )}

        {step === 'importing' && (
          <div className="text-center py-8">
            <div className="w-full h-2 bg-muted rounded-full overflow-hidden mb-3">
              <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progress}%` }} />
            </div>
            <p className="text-sm text-muted-foreground">Importing... {progress}%</p>
          </div>
        )}
      </div>
    </div>
  );
};
