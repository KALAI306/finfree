import { registerPlugin } from '@capacitor/core';
import type { PluginListenerHandle } from '@capacitor/core';

export interface SmsMessage {
  sender: string;
  body: string;
  timestamp: number;
}

export interface UpiSmsPlugin {
  startListening(): Promise<{ status: string }>;
  stopListening(): Promise<{ status: string }>;
  readSmsHistory(options: { days: number }): Promise<{ messages: SmsMessage[]; count: number }>;
  checkPermissions(): Promise<{ sms: 'granted' | 'denied' | 'prompt' }>;
  requestPermissions(): Promise<{ sms: 'granted' | 'denied' | 'prompt' }>;
  addListener(event: 'smsReceived', handler: (data: SmsMessage) => void): Promise<PluginListenerHandle>;
  removeAllListeners(): Promise<void>;
}

export const UpiSms = registerPlugin<UpiSmsPlugin>('UpiSms');
