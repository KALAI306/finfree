/**
 * SIP (Systematic Investment Plan) storage + auto-debit.
 *
 * SIP schedules are keyed by investment id. When a schedule has an
 * `account_id`, runSipAutoDebits() creates the monthly expense transaction
 * from that account on/after the chosen day — deduplicated per calendar month.
 * The account link is entirely optional: without it, the SIP is just a label.
 */

const SIP_STORAGE_KEY = "investment_sip_data";

export interface SipData {
  sip_amount: number;
  sip_date: number;        // day of month, 1–28
  account_id?: string;     // optional auto-debit source
  category?: string;       // transaction category, default "Investment 📈"
  name?: string;           // investment name, used in the transaction note
}

export function getSipStore(): Record<string, SipData> {
  try {
    return JSON.parse(localStorage.getItem(SIP_STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

export function saveSipEntry(id: string, data: SipData) {
  const store = getSipStore();
  store[id] = data;
  localStorage.setItem(SIP_STORAGE_KEY, JSON.stringify(store));
}

export function removeSipEntry(id: string) {
  const store = getSipStore();
  delete store[id];
  localStorage.setItem(SIP_STORAGE_KEY, JSON.stringify(store));
}

export function getSipEntry(id: string): SipData | null {
  return getSipStore()[id] || null;
}

type AddTx = (tx: {
  user_id: string;
  account_id: string;
  type: "income" | "expense" | "transfer";
  amount: number;
  category: string;
  note: string;
  date: string;
  is_recurring: boolean;
}) => Promise<unknown>;

/**
 * Execute any SIP that has a linked account and is due this month.
 * Returns the number of debit transactions created.
 */
export async function runSipAutoDebits(userId: string, addTransaction: AddTx): Promise<number> {
  const store = getSipStore();
  const now = new Date();
  const dom = now.getDate();
  const monthKey = now.toISOString().slice(0, 7);
  const today = now.toISOString().split("T")[0];
  let executed = 0;

  for (const [invId, sip] of Object.entries(store)) {
    if (!sip.account_id || !(sip.sip_amount > 0)) continue;   // no auto-debit configured
    if (dom < (sip.sip_date || 1)) continue;                  // not due yet this month
    const marker = `finfree_sip_done_${userId}_${invId}_${monthKey}`;
    if (localStorage.getItem(marker)) continue;               // already debited this month

    try {
      await addTransaction({
        user_id: userId,
        account_id: sip.account_id,
        type: "expense",
        amount: sip.sip_amount,
        category: sip.category || "Investment 📈",
        note: `SIP · ${sip.name || "Investment"}`,
        date: today,
        is_recurring: false,
      });
      localStorage.setItem(marker, "1");
      executed++;
    } catch (e) {
      console.warn("SIP auto-debit failed for", invId, e);
    }
  }
  return executed;
}
