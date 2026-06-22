import React, { useEffect } from "react";
import { X } from "lucide-react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children }) => {
  // Prevent background scrolling when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center p-0 md:p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity duration-300 animate-in fade-in"
        onClick={onClose}
      />
      
      {/* Content Card (Bottom Sheet on Mobile, Centered Modal on Desktop) */}
      <div 
        className="relative w-full md:max-w-lg bg-card border-t border-x md:border border-border rounded-t-3xl md:rounded-2xl shadow-2xl p-6 z-10 max-h-[85vh] md:max-h-[90vh] overflow-y-auto transform transition-all duration-300 animate-in slide-in-from-bottom md:zoom-in-95"
        role="dialog"
        aria-modal="true"
      >
        {/* Header Drag Bar / Close Indicator for Mobile Drawer */}
        <div className="flex md:hidden justify-center mb-4">
          <div className="w-12 h-1 bg-muted rounded-full" onClick={onClose} />
        </div>

        <div className="flex justify-between items-center mb-6 pb-2 border-b border-border">
          <h3 className="text-xl font-bold text-foreground">
            {title}
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4 text-foreground">
          {children}
        </div>
      </div>
    </div>
  );
};
