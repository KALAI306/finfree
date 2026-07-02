import React, { useState, useEffect, useRef } from "react";
import { ChevronDown, Check, Search, X } from "lucide-react";

export interface SelectOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
  description?: string;
  color?: string;
}

interface CustomSelectProps {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  error?: string;
  searchable?: boolean;
  className?: string;
  disabled?: boolean;
}

export const CustomSelect: React.FC<CustomSelectProps> = ({
  options,
  value,
  onChange,
  placeholder = "Select an option",
  label,
  error,
  searchable = false,
  className = "",
  disabled = false,
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  const selectedOption = options.find(o => o.value === value);

  const filtered = search
    ? options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()))
    : options;

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      if (searchable) setTimeout(() => searchRef.current?.focus(), 100);
    } else {
      document.body.style.overflow = "";
      setSearch("");
    }
    return () => { document.body.style.overflow = ""; };
  }, [open, searchable]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  return (
    <div className={`relative ${className}`}>
      {label && (
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
          {label}
        </label>
      )}

      {/* Trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(true)}
        className={`w-full flex items-center justify-between gap-2 bg-background border rounded-xl py-3 px-3.5 text-sm transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500/50
          ${error ? "border-rose-500" : "border-border hover:border-gold-500/60 focus:border-gold-500"}
          ${disabled ? "opacity-50 cursor-not-allowed" : ""}
          ${selectedOption ? "text-foreground" : "text-muted-foreground"}`}
      >
        <span className="flex items-center gap-2.5 min-w-0">
          {selectedOption?.icon && (
            <span className="shrink-0 text-base leading-none">{selectedOption.icon}</span>
          )}
          <span className="truncate font-medium">{selectedOption?.label || placeholder}</span>
        </span>
        <ChevronDown
          className={`w-4 h-4 shrink-0 text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {error && <p className="text-rose-400 text-xs mt-1">{error}</p>}

      {/* Overlay + Bottom Sheet */}
      {open && (
        <>
          {/* Backdrop — pointerdown fires reliably on touch, unlike click which
              can be swallowed if the finger moves a few px (scroll intent) */}
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-[2px] z-40 animate-fade-in"
            onPointerDown={() => setOpen(false)}
            onClick={() => setOpen(false)}
          />

          {/* Sheet — slides up on mobile, floats on desktop */}
          <div className="fixed bottom-0 left-0 right-0 z-50 md:absolute md:bottom-auto md:top-[calc(100%+6px)] md:left-0 md:right-auto md:min-w-full md:w-max md:max-w-xs animate-slide-up md:animate-fade-in">
            <div className="bg-card border border-border rounded-t-3xl md:rounded-2xl shadow-2xl flex flex-col max-h-[72vh] md:max-h-72 overflow-hidden">

              {/* Drag handle (mobile only) */}
              <div className="flex justify-center pt-3 pb-1 md:hidden shrink-0">
                <div className="w-10 h-1 rounded-full bg-border" />
              </div>

              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
                <span className="font-bold text-foreground text-sm">{label || "Select"}</span>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-muted transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>

              {/* Search */}
              {searchable && (
                <div className="px-3 py-2.5 border-b border-border shrink-0">
                  <div className="flex items-center gap-2 bg-muted rounded-xl px-3 py-2.5">
                    <Search className="w-4 h-4 text-muted-foreground shrink-0" />
                    <input
                      ref={searchRef}
                      type="text"
                      placeholder="Search..."
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                    />
                    {search && (
                      <button type="button" onClick={() => setSearch("")}>
                        <X className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Options */}
              <div className="overflow-y-auto flex-1 overscroll-contain py-1.5">
                {filtered.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    No results found
                  </div>
                ) : (
                  filtered.map(option => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => { onChange(option.value); setOpen(false); }}
                      className={`w-full flex items-center gap-3 px-4 py-3.5 text-sm transition-colors cursor-pointer active:bg-muted min-h-[52px] text-left
                        ${option.value === value
                          ? "bg-gold-500/10 text-gold-500"
                          : "text-foreground hover:bg-muted/60"
                        }`}
                    >
                      {option.icon && (
                        <span className="shrink-0 w-5 text-center text-base leading-none">
                          {option.icon}
                        </span>
                      )}
                      <span className="flex-1 min-w-0">
                        <span className="block font-medium truncate">{option.label}</span>
                        {option.description && (
                          <span className="block text-xs text-muted-foreground mt-0.5 truncate">
                            {option.description}
                          </span>
                        )}
                      </span>
                      {option.value === value && (
                        <Check className="w-4 h-4 shrink-0 text-gold-500" />
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

/* ── Lightweight number input with mobile fixes ── */
interface NumberInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "type"> {
  value: string | number;
  onChange: (val: string) => void;
  decimals?: boolean;
  label?: string;
  error?: string;
  prefix?: string;
  suffix?: string;
}

export const NumberInput: React.FC<NumberInputProps> = ({
  value,
  onChange,
  decimals = false,
  label,
  error,
  prefix,
  suffix,
  className = "",
  placeholder,
  ...rest
}) => {
  return (
    <div className={className}>
      {label && (
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
          {label}
        </label>
      )}
      <div className="relative flex items-center">
        {prefix && (
          <span className="absolute left-3.5 text-muted-foreground text-sm font-medium pointer-events-none select-none">
            {prefix}
          </span>
        )}
        <input
          type="text"
          inputMode={decimals ? "decimal" : "numeric"}
          pattern={decimals ? "[0-9]*\\.?[0-9]*" : "[0-9]*"}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          value={value}
          placeholder={placeholder}
          onFocus={e => e.target.select()}
          onChange={e => {
            const raw = e.target.value;
            if (decimals) {
              if (/^[0-9]*\.?[0-9]*$/.test(raw)) onChange(raw);
            } else {
              if (/^[0-9]*$/.test(raw)) onChange(raw);
            }
          }}
          className={`w-full bg-background border rounded-xl py-3 text-foreground text-sm focus:outline-none focus:border-gold-500 transition-colors min-h-[48px]
            ${error ? "border-rose-500" : "border-border hover:border-gold-500/40"}
            ${prefix ? "pl-8 pr-3.5" : "px-3.5"}
            ${suffix ? "pr-12" : ""}`}
          {...rest}
        />
        {suffix && (
          <span className="absolute right-3.5 text-muted-foreground text-sm pointer-events-none select-none">
            {suffix}
          </span>
        )}
      </div>
      {error && <p className="text-rose-400 text-xs mt-1">{error}</p>}
    </div>
  );
};
