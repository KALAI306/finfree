import React, { useState } from 'react';
import { Flame, Smartphone, Cloud, ShieldCheck, Wifi, ArrowRight } from 'lucide-react';
import { setStorageMode } from '../lib/storageMode';

interface Props {
  onDone: () => void;
}

export const StorageSetup: React.FC<Props> = ({ onDone }) => {
  const [selected, setSelected] = useState<'local' | 'cloud' | null>(null);
  const [confirming, setConfirming] = useState(false);

  const confirm = () => {
    if (!selected) return;
    setConfirming(true);
    setStorageMode(selected);
    setTimeout(onDone, 300);
  };

  return (
    <div className="min-h-screen aurora-bg flex flex-col items-center justify-center px-5 py-10">
      {/* Logo */}
      <div className="flex flex-col items-center mb-8">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
          style={{ background: 'linear-gradient(135deg, hsl(var(--primary)/0.9), hsl(var(--primary)))', boxShadow: '0 8px 32px hsl(var(--primary)/0.4)' }}>
          <Flame className="w-8 h-8 text-primary-foreground" strokeWidth={2.5} />
        </div>
        <h1 className="text-2xl font-bold text-foreground">Where to store your data?</h1>
        <p className="text-sm text-muted-foreground mt-1.5 text-center max-w-xs">
          Choose how FinFree saves your financial data. You can change this anytime in Settings.
        </p>
      </div>

      {/* Cards */}
      <div className="w-full max-w-sm space-y-4">
        {/* Local */}
        <button
          onClick={() => setSelected('local')}
          className={`w-full text-left p-5 rounded-2xl border-2 transition-all duration-200 ${
            selected === 'local'
              ? 'border-primary bg-primary/10'
              : 'border-border/50 bg-white/[0.03] hover:border-border'
          }`}
        >
          <div className="flex items-start gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
              selected === 'local' ? 'bg-primary/20' : 'bg-white/[0.06]'
            }`}>
              <Smartphone className={`w-6 h-6 ${selected === 'local' ? 'text-primary' : 'text-muted-foreground'}`} />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-foreground">Local Only</h3>
              <p className="text-xs text-muted-foreground mt-1">Data stays on your phone. No account needed. 100% private.</p>
              <div className="flex flex-wrap gap-3 mt-3">
                {['No internet needed', 'Fully private', 'Works offline'].map(t => (
                  <span key={t} className="flex items-center gap-1 text-[11px] text-emerald-400">
                    <ShieldCheck className="w-3 h-3" /> {t}
                  </span>
                ))}
              </div>
            </div>
            <div className={`w-5 h-5 rounded-full border-2 shrink-0 mt-0.5 flex items-center justify-center ${
              selected === 'local' ? 'border-primary bg-primary' : 'border-border'
            }`}>
              {selected === 'local' && <div className="w-2 h-2 rounded-full bg-primary-foreground" />}
            </div>
          </div>
        </button>

        {/* Cloud */}
        <button
          onClick={() => setSelected('cloud')}
          className={`w-full text-left p-5 rounded-2xl border-2 transition-all duration-200 ${
            selected === 'cloud'
              ? 'border-primary bg-primary/10'
              : 'border-border/50 bg-white/[0.03] hover:border-border'
          }`}
        >
          <div className="flex items-start gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
              selected === 'cloud' ? 'bg-primary/20' : 'bg-white/[0.06]'
            }`}>
              <Cloud className={`w-6 h-6 ${selected === 'cloud' ? 'text-primary' : 'text-muted-foreground'}`} />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-foreground">Cloud Sync</h3>
              <p className="text-xs text-muted-foreground mt-1">Data synced online. Access from any device. Requires account.</p>
              <div className="flex flex-wrap gap-3 mt-3">
                {['Multi-device', 'Auto backup', 'Web access'].map(t => (
                  <span key={t} className="flex items-center gap-1 text-[11px] text-blue-400">
                    <Wifi className="w-3 h-3" /> {t}
                  </span>
                ))}
              </div>
            </div>
            <div className={`w-5 h-5 rounded-full border-2 shrink-0 mt-0.5 flex items-center justify-center ${
              selected === 'cloud' ? 'border-primary bg-primary' : 'border-border'
            }`}>
              {selected === 'cloud' && <div className="w-2 h-2 rounded-full bg-primary-foreground" />}
            </div>
          </div>
        </button>
      </div>

      {/* Continue button */}
      <button
        onClick={confirm}
        disabled={!selected || confirming}
        className="mt-8 w-full max-w-sm btn-primary py-3.5 flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
      >
        {confirming
          ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
          : <>Continue <ArrowRight className="w-4 h-4" /></>
        }
      </button>

      <p className="text-[11px] text-muted-foreground mt-4 text-center max-w-xs">
        You can export your data anytime and switch between modes from Settings.
      </p>
    </div>
  );
};
