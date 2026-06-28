import React, { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Fingerprint } from 'lucide-react';

let BiometricAuth: any = null;

async function getBiometric() {
  if (!BiometricAuth) {
    try {
      const mod = await import('@aparajita/capacitor-biometric-auth');
      BiometricAuth = mod.BiometricAuth;
    } catch { /* not available in web */ }
  }
  return BiometricAuth;
}

interface Props {
  onUnlocked: () => void;
}

export const BiometricLock: React.FC<Props> = ({ onUnlocked }) => {
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(true);
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) { onUnlocked(); return; }
    checkAndAuth();
  }, []);

  const checkAndAuth = async () => {
    try {
      const bio = await getBiometric();
      if (!bio) { onUnlocked(); return; }

      const info = await bio.checkBiometry();
      if (!info.isAvailable) {
        onUnlocked();
        return;
      }
      setAvailable(true);
      await attemptAuth();
    } catch {
      onUnlocked();
    } finally {
      setChecking(false);
    }
  };

  const attemptAuth = async () => {
    setError('');
    try {
      const bio = await getBiometric();
      await bio.authenticate({
        reason: 'Unlock FinFree',
        cancelTitle: 'Cancel',
        allowDeviceCredential: true,
        iosFallbackTitle: 'Use Passcode',
      });
      onUnlocked();
    } catch (e: any) {
      if (e?.code === 'userCancel') {
        setError('Authentication cancelled');
      } else {
        setError('Biometric failed — try again');
      }
    }
  };

  if (checking) {
    return (
      <div className="fixed inset-0 z-[9999] bg-background flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!available) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-background flex flex-col items-center justify-center gap-6 p-8">
      <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
        <Fingerprint className="w-8 h-8 text-primary" />
      </div>
      <div className="text-center">
        <h2 className="text-xl font-bold text-foreground mb-1">FinFree</h2>
        <p className="text-sm text-muted-foreground">Authenticate to access your finances</p>
      </div>
      {error && <p className="text-sm text-rose-400">{error}</p>}
      <button
        onClick={attemptAuth}
        className="btn-primary px-8 py-3 flex items-center gap-2"
      >
        <Fingerprint className="w-4 h-4" />
        {error ? 'Try Again' : 'Unlock with Biometrics'}
      </button>
    </div>
  );
};
