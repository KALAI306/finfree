import { Capacitor } from '@capacitor/core';
import { UpiSms, type SmsMessage } from '../plugins/upi-sms';
import { parseUpiSms, type ParsedUpiSms } from './smsParser';
import { categorizeByMerchant } from './smsCategories';

export interface UpiTransaction extends ParsedUpiSms {
  category: string;
  id?: string;
}

type SmsCallback = (tx: UpiTransaction) => void;

let listener: any = null;
let callback: SmsCallback | null = null;

export function isNativePlatform(): boolean {
  return Capacitor.isNativePlatform();
}

export async function checkSmsPermission(): Promise<'granted' | 'denied' | 'prompt'> {
  if (!isNativePlatform()) return 'denied';
  const result = await UpiSms.checkPermissions();
  return result.sms;
}

export async function requestSmsPermission(): Promise<'granted' | 'denied' | 'prompt'> {
  if (!isNativePlatform()) return 'denied';
  const result = await UpiSms.requestPermissions();
  return result.sms;
}

export async function startSmsListener(onTransaction: SmsCallback): Promise<boolean> {
  if (!isNativePlatform()) return false;

  const perm = await checkSmsPermission();
  if (perm !== 'granted') return false;

  callback = onTransaction;

  listener = await UpiSms.addListener('smsReceived', (data: SmsMessage) => {
    const parsed = parseUpiSms(data.body, data.sender, data.timestamp);
    if (!parsed) return;

    const category = categorizeByMerchant(parsed.merchant);
    const tx: UpiTransaction = { ...parsed, category };

    if (callback) callback(tx);
  });

  await UpiSms.startListening();
  return true;
}

export async function stopSmsListener(): Promise<void> {
  if (!isNativePlatform()) return;
  await UpiSms.stopListening();
  if (listener) {
    listener.remove();
    listener = null;
  }
  callback = null;
}

export async function readSmsHistory(days: number = 90): Promise<UpiTransaction[]> {
  if (!isNativePlatform()) return [];

  const perm = await checkSmsPermission();
  if (perm !== 'granted') return [];

  const { messages } = await UpiSms.readSmsHistory({ days });
  const transactions: UpiTransaction[] = [];

  for (const msg of messages) {
    const parsed = parseUpiSms(msg.body, msg.sender, msg.timestamp);
    if (!parsed) continue;
    const category = categorizeByMerchant(parsed.merchant);
    transactions.push({ ...parsed, category });
  }

  return transactions;
}

export function isDuplicate(upiRef: string | null, existingNotes: string[]): boolean {
  if (!upiRef) return false;
  const marker = `[UPI:${upiRef}]`;
  return existingNotes.some(note => note?.includes(marker));
}
