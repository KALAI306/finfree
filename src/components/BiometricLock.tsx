import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { Fingerprint, Delete, Flame, Shield } from 'lucide-react';

// ── PIN helpers ───────────────────────────────────────────────────────────────

const PIN_HASH_KEY = 'finfree_pin_hash';
const SESSION_KEY  = 'finfree_session_unlocked';

async function hashPin(pin: string): Promise<string> {
  const data = new TextEncoder().encode(pin + '_finfree_salt_2024');
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export function isPinSet(): boolean {
  try { return !!localStorage.getItem(PIN_HASH_KEY); } catch { return false; }
}

export async function setPin(pin: string): Promise<void> {
  try { localStorage.setItem(PIN_HASH_KEY, await hashPin(pin)); } catch {}
}

export function clearPin(): void {
  try { localStorage.removeItem(PIN_HASH_KEY); } catch {}
}

export async function verifyPin(pin: string): Promise<boolean> {
  try {
    const stored = localStorage.getItem(PIN_HASH_KEY);
    if (!stored) return true;
    return stored === await hashPin(pin);
  } catch { return true; }
}

// ── Safe session helpers ──────────────────────────────────────────────────────

function sessionUnlocked(): boolean {
  try { return !!sessionStorage.getItem(SESSION_KEY); } catch { return false; }
}
function markSessionUnlocked(): void {
  try { sessionStorage.setItem(SESSION_KEY, '1'); } catch {}
}

// ── Biometric helpers ─────────────────────────────────────────────────────────

let BiometricAuth: any = null;
async function getBiometric() {
  if (!BiometricAuth) {
    try {
      const m = await import('@aparajita/capacitor-biometric-auth');
      BiometricAuth = m.BiometricAuth;
    } catch {}
  }
  return BiometricAuth;
}

// ── PIN Pad UI ────────────────────────────────────────────────────────────────

const KEYS = ['1','2','3','4','5','6','7','8','9','','0','⌫'];

interface PinPadProps {
  onSuccess: (pin: string) => void;
  onCancel?: () => void;
  verify?: boolean;
  confirmPin?: string;
}

export const PinPad: React.FC<PinPadProps> = ({ onSuccess, onCancel, verify = true, confirmPin }) => {
  const [pin, setPin] = useState('');
  const [shake, setShake] = useState(false);
  const [error, setError] = useState('');

  const handleKey = useCallback(async (key: string) => {
    if (key === '⌫') { setPin(p => p.slice(0, -1)); setError(''); return; }
    if (pin.length >= 4) return;
    const next = pin + key;
    setPin(next);

    if (next.length === 4) {
      setTimeout(async () => {
        let ok = false;
        if (verify) {
          ok = await verifyPin(next);
        } else if (confirmPin !== undefined) {
          ok = next === confirmPin;
        } else {
          ok = true;
        }

        if (ok) {
          onSuccess(next);
        } else {
          setShake(true);
          setError(verify ? 'Incorrect PIN' : 'PINs do not match — try again');
          setPin('');
          setTimeout(() => setShake(false), 500);
        }
      }, 80);
    }
  }, [pin, verify, confirmPin, onSuccess]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') handleKey(e.key);
      if (e.key === 'Backspace') handleKey('⌫');
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleKey]);

  return (
    <div className={`flex flex-col items-center gap-6 ${shake ? 'animate-[shake_0.4s_ease]' : ''}`}>
      <div className="flex items-center gap-3">
        {[0,1,2,3].map(i => (
          <div key={i} className={`w-3.5 h-3.5 rounded-full border-2 transition-all duration-150 ${
            pin.length > i ? 'bg-primary border-primary' : 'border-muted-foreground/40'
          }`} />
        ))}
      </div>
      {error && <p className="text-xs text-rose-400 font-medium">{error}</p>}
      <div className="grid grid-cols-3 gap-3">
        {KEYS.map((key, i) => (
          key === '' ? <div key={i} /> : (
            <button key={i} onClick={() => handleKey(key)}
              className={`w-16 h-16 rounded-2xl text-lg font-semibold transition-all active:scale-95 cursor-pointer
                ${key === '⌫'
                  ? 'bg-muted/40 border border-border/50 text-muted-foreground hover:bg-muted/60'
                  : 'bg-muted/30 border border-border/40 text-foreground hover:bg-muted/60 hover:border-primary/30'
                }`}
            >
              {key === '⌫' ? <Delete className="w-4 h-4 mx-auto" /> : key}
            </button>
          )
        ))}
      </div>
      {onCancel && (
        <button onClick={onCancel} className="text-xs text-muted-foreground hover:text-foreground transition-colors mt-1 cursor-pointer">
          Cancel
        </button>
      )}
    </div>
  );
};

// ── Lock Screen ───────────────────────────────────────────────────────────────

interface LockProps { onUnlocked: () => void; }

export const BiometricLock: React.FC<LockProps> = ({ onUnlocked }) => {
  const [mode, setMode] = useState<'checking' | 'biometric' | 'pin'>('checking');
  const [bioAvailable, setBioAvailable] = useState(false);
  const [bioError, setBioError] = useState('');
  const doneRef = useRef(false);
  const bioRef = useRef<any>(null);

  const safeUnlock = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    markSessionUnlocked();
    onUnlocked();
  }, [onUnlocked]);

  const triggerBiometric = useCallback(async () => {
    setBioError('');
    try {
      const bio = bioRef.current || await getBiometric();
      if (!bio) { safeUnlock(); return; }
      await bio.authenticate({
        reason: 'Unlock FinFree',
        cancelTitle: 'Use PIN',
        allowDeviceCredential: false,
        iosFallbackTitle: 'Use PIN',
      });
      safeUnlock();
    } catch (e: any) {
      const msg = (e?.code || e?.message || '').toLowerCase();
      if (msg.includes('cancel') || msg.includes('usercancel')) {
        // User tapped "Use PIN" / cancelled → show PIN pad
        if (isPinSet()) setMode('pin');
        else setBioError('Cancelled. Tap to try again.');
      } else {
        setBioError('Biometric failed. Tap to retry or use PIN below.');
      }
    }
  }, [safeUnlock]);

  useEffect(() => {
    if (sessionUnlocked()) { safeUnlock(); return; }

    if (!Capacitor.isNativePlatform()) {
      // Web: PIN lock if the user set one; otherwise let through
      if (isPinSet()) setMode('pin');
      else safeUnlock();
      return;
    }

    // ── Native (Android / iOS) ────────────────────────────────────────────────
    // Timeout: if the plugin hangs, fall back gracefully
    const timeout = setTimeout(() => {
      if (isPinSet()) setMode('pin');
      else safeUnlock();
    }, 5000);

    const init = async () => {
      try {
        const bio = await getBiometric();
        bioRef.current = bio;

        if (!bio) {
          clearTimeout(timeout);
          if (isPinSet()) setMode('pin');
          else safeUnlock();
          return;
        }

        const info = await bio.checkBiometry();
        clearTimeout(timeout);

        const hasBio = !!info.isAvailable;
        setBioAvailable(hasBio);

        if (isPinSet()) {
          // PIN set → show PIN pad; user can switch to fingerprint with button
          setMode('pin');
        } else if (hasBio) {
          // No PIN, bio available → show fingerprint screen and auto-trigger
          setMode('biometric');
          // Small delay so the UI renders before the system dialog appears
          setTimeout(() => triggerBiometric(), 300);
        } else {
          // No PIN, no bio → no lock
          safeUnlock();
        }
      } catch {
        clearTimeout(timeout);
        if (isPinSet()) setMode('pin');
        else safeUnlock();
      }
    };

    init();
    return () => clearTimeout(timeout);
  }, [safeUnlock, triggerBiometric]);

  if (mode === 'checking') {
    return (
      <div className="fixed inset-0 z-[9999] bg-background flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[9999] bg-background flex flex-col items-center justify-center gap-6 px-8"
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>

      <div className="flex flex-col items-center gap-3 mb-2">
        <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center shadow-lg"
          style={{ boxShadow: '0 4px 24px hsl(var(--primary)/0.4)' }}>
          <Flame className="w-7 h-7 text-primary-foreground" strokeWidth={2.5} />
        </div>
        <div className="text-center">
          <h1 className="text-xl font-bold text-foreground">FinFree</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {mode === 'biometric' ? 'Authenticate to continue' : 'Enter your PIN to continue'}
          </p>
        </div>
      </div>

      {mode === 'biometric' ? (
        <div className="flex flex-col items-center gap-4">
          <div className="w-20 h-20 rounded-full bg-primary/10 border-2 border-primary/20 flex items-center justify-center">
            <Fingerprint className="w-10 h-10 text-primary" />
          </div>
          {bioError && <p className="text-sm text-rose-400 text-center max-w-xs">{bioError}</p>}
          <div className="flex flex-col items-center gap-2">
            <button onClick={triggerBiometric}
              className="btn-primary px-8 py-3 flex items-center gap-2 cursor-pointer">
              <Fingerprint className="w-4 h-4" />
              {bioError ? 'Try Again' : 'Use Fingerprint'}
            </button>
            {isPinSet() && (
              <button onClick={() => setMode('pin')}
                className="text-xs text-muted-foreground hover:text-primary transition-colors cursor-pointer mt-1">
                Use PIN instead
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 w-full max-w-xs">
          <div className="flex items-center gap-1.5 mb-1">
            <Shield className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-medium text-muted-foreground">Enter your 4-digit PIN</span>
          </div>
          <PinPad
            verify={true}
            onSuccess={safeUnlock}
            onCancel={undefined}
          />
          {/* Show "Use Fingerprint" button if bio is available on Android */}
          {Capacitor.isNativePlatform() && bioAvailable && (
            <button
              onClick={() => { setMode('biometric'); setTimeout(() => triggerBiometric(), 100); }}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors cursor-pointer mt-2">
              <Fingerprint className="w-3.5 h-3.5" />
              Use fingerprint instead
            </button>
          )}
        </div>
      )}
    </div>
  );
};
