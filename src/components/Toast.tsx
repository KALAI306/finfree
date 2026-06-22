import React from "react";
import { useApp } from "../context/AppContext";
import { AlertCircle, CheckCircle, Info, X, AlertTriangle } from "lucide-react";

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useApp();

  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 w-full max-w-sm px-4 md:px-0 pointer-events-none">
      {toasts.map((toast) => {
        const typeStyles = {
          success: "bg-emerald-950/90 text-emerald-300 border-emerald-500/30 shadow-emerald-950/20",
          warning: "bg-amber-950/90 text-amber-300 border-amber-500/30 shadow-amber-950/20",
          error: "bg-rose-950/90 text-rose-300 border-rose-500/30 shadow-rose-950/20",
          info: "bg-sky-950/90 text-sky-300 border-sky-500/30 shadow-sky-950/20",
        };

        const icons = {
          success: <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />,
          warning: <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />,
          error: <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />,
          info: <Info className="w-5 h-5 text-sky-400 shrink-0" />,
        };

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl border backdrop-blur-md shadow-lg transition-all duration-300 transform translate-y-0 animate-in slide-in-from-top-4 ${typeStyles[toast.type]}`}
          >
            {icons[toast.type]}
            <div className="flex-1 text-sm font-medium pr-2 leading-relaxed">
              {toast.message}
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-current opacity-70 hover:opacity-100 transition-opacity p-0.5 rounded-lg hover:bg-white/10"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
