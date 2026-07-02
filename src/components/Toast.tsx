import React from "react";
import { useApp } from "../context/AppContext";
import { AlertCircle, CheckCircle, Info, X, AlertTriangle } from "lucide-react";

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useApp();

  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none" style={{ maxWidth: 320 }}>
      {toasts.map((toast) => {
        const accent = {
          success: { border: 'border-l-emerald-500', icon: 'text-emerald-500', bg: 'bg-card' },
          warning: { border: 'border-l-amber-500',   icon: 'text-amber-500',   bg: 'bg-card' },
          error:   { border: 'border-l-rose-500',    icon: 'text-rose-500',    bg: 'bg-card' },
          info:    { border: 'border-l-sky-500',     icon: 'text-sky-500',     bg: 'bg-card' },
        }[toast.type];

        const icons = {
          success: <CheckCircle  className={`w-4 h-4 shrink-0 ${accent.icon}`} />,
          warning: <AlertTriangle className={`w-4 h-4 shrink-0 ${accent.icon}`} />,
          error:   <AlertCircle  className={`w-4 h-4 shrink-0 ${accent.icon}`} />,
          info:    <Info         className={`w-4 h-4 shrink-0 ${accent.icon}`} />,
        };

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-center gap-3 pl-3 pr-2 py-3 rounded-xl border border-l-4 shadow-xl backdrop-blur-sm transition-all duration-200 animate-in slide-in-from-right-4 ${accent.bg} border-border ${accent.border}`}
          >
            {icons[toast.type]}
            <p className="flex-1 text-xs font-medium text-foreground leading-snug">{toast.message}</p>
            <button
              onClick={() => removeToast(toast.id)}
              className="shrink-0 p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
