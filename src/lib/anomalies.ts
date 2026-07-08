import type { Transaction } from './db';

export type AnomalyType = 'spike' | 'duplicate' | 'large_new';
export type AnomalySeverity = 'warning' | 'info';

export interface Anomaly {
  id: string;
  type: AnomalyType;
  severity: AnomalySeverity;
  title: string;
  description: string;
  amount: number;
  category?: string;
  date: string;
  dismissKey: string;
}

function monthlyAvg(txs: Transaction[], category: string, endDate: Date, lookbackMonths: number): number {
  const totals: number[] = [];
  for (let i = 1; i <= lookbackMonths; i++) {
    const mo = new Date(endDate.getFullYear(), endDate.getMonth() - i, 1);
    const sum = txs
      .filter(t => {
        const d = new Date(t.date);
        return t.type === 'expense' && t.category === category &&
          d.getFullYear() === mo.getFullYear() && d.getMonth() === mo.getMonth();
      })
      .reduce((s, t) => s + Number(t.amount), 0);
    if (sum > 0) totals.push(sum);
  }
  return totals.length ? totals.reduce((a, b) => a + b, 0) / totals.length : 0;
}

export function detectAnomalies(transactions: Transaction[]): Anomaly[] {
  const anomalies: Anomaly[] = [];
  const now = new Date();
  const thisMonth = transactions.filter(t => {
    const d = new Date(t.date);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  });

  // ── Rule 1: Category spike > 2.5× trailing-3-month average ──────────────────
  const categories = [...new Set(thisMonth.filter(t => t.type === 'expense').map(t => t.category))];
  for (const cat of categories) {
    const currentSpend = thisMonth
      .filter(t => t.type === 'expense' && t.category === cat)
      .reduce((s, t) => s + Number(t.amount), 0);
    const avg = monthlyAvg(transactions, cat, now, 3);
    if (avg > 500 && currentSpend > avg * 2.5) {
      anomalies.push({
        id: `spike-${cat}`,
        type: 'spike',
        severity: 'warning',
        title: `${cat} spending spike`,
        description: `₹${Math.round(currentSpend).toLocaleString('en-IN')} this month vs avg ₹${Math.round(avg).toLocaleString('en-IN')} — ${((currentSpend / avg) * 100 - 100).toFixed(0)}% above normal`,
        amount: currentSpend,
        category: cat,
        date: now.toISOString().slice(0, 10),
        dismissKey: `spike-${cat}-${now.getFullYear()}-${now.getMonth()}`,
      });
    }
  }

  // ── Rule 2: Duplicate transactions (same amount + category within 48h) ────────
  const expenseTxs = transactions
    .filter(t => t.type === 'expense')
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 200);

  const seen = new Set<string>();
  for (let i = 0; i < expenseTxs.length; i++) {
    for (let j = i + 1; j < expenseTxs.length; j++) {
      const a = expenseTxs[i];
      const b = expenseTxs[j];
      const diff = Math.abs(new Date(a.date).getTime() - new Date(b.date).getTime());
      const hours48 = 48 * 3600 * 1000;
      const key = `dup-${a.category}-${a.amount}`;
      if (!seen.has(key) && diff <= hours48 && a.category === b.category && Number(a.amount) === Number(b.amount) && Number(a.amount) > 100) {
        seen.add(key);
        anomalies.push({
          id: key,
          type: 'duplicate',
          severity: 'warning',
          title: `Possible duplicate charge`,
          description: `₹${Number(a.amount).toLocaleString('en-IN')} in ${a.category} appears twice within 48 hours (${a.date} & ${b.date})`,
          amount: Number(a.amount),
          category: a.category,
          date: a.date,
          dismissKey: `${key}-${a.date}`,
        });
      }
    }
  }

  // ── Rule 3: Large transaction to a merchant not seen before ──────────────────
  const recentLarge = transactions
    .filter(t => t.type === 'expense' && Number(t.amount) >= 5000)
    .filter(t => {
      const d = new Date(t.date);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    });

  for (const tx of recentLarge) {
    const note = (tx.note || '').trim();
    if (!note) continue;
    const seen3mAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
    const prevOccurrences = transactions.filter(t =>
      t.id !== tx.id &&
      t.type === 'expense' &&
      t.note === note &&
      new Date(t.date) < new Date(tx.date) &&
      new Date(t.date) >= seen3mAgo,
    );
    const dupKey = `large-${tx.id}`;
    if (prevOccurrences.length === 0 && !seen.has(dupKey)) {
      seen.add(dupKey);
      anomalies.push({
        id: dupKey,
        type: 'large_new',
        severity: 'info',
        title: `Large new expense`,
        description: `₹${Number(tx.amount).toLocaleString('en-IN')} at "${note}" — first time seeing this merchant in 3 months`,
        amount: Number(tx.amount),
        category: tx.category,
        date: tx.date,
        dismissKey: `${dupKey}-${tx.date}`,
      });
    }
  }

  return anomalies.slice(0, 6); // cap at 6 to keep UI clean
}
