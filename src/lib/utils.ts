import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const CURRENCIES = [
  { code: 'INR', symbol: '₹',   name: 'Indian Rupee',       locale: 'en-IN' },
  { code: 'USD', symbol: '$',   name: 'US Dollar',          locale: 'en-US' },
  { code: 'EUR', symbol: '€',   name: 'Euro',               locale: 'de-DE' },
  { code: 'GBP', symbol: '£',   name: 'British Pound',      locale: 'en-GB' },
  { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham',         locale: 'en-AE' },
  { code: 'SGD', symbol: 'S$',  name: 'Singapore Dollar',   locale: 'en-SG' },
  { code: 'CAD', symbol: 'C$',  name: 'Canadian Dollar',    locale: 'en-CA' },
  { code: 'AUD', symbol: 'A$',  name: 'Australian Dollar',  locale: 'en-AU' },
  { code: 'JPY', symbol: '¥',   name: 'Japanese Yen',       locale: 'ja-JP' },
  { code: 'MYR', symbol: 'RM',  name: 'Malaysian Ringgit',  locale: 'ms-MY' },
  { code: 'MXN', symbol: 'MX$', name: 'Mexican Peso',       locale: 'es-MX' },
  { code: 'BRL', symbol: 'R$',  name: 'Brazilian Real',     locale: 'pt-BR' },
] as const;

export type CurrencyCode = typeof CURRENCIES[number]['code'];

export function getCurrencyInfo(code: string) {
  return CURRENCIES.find(c => c.code === code) ?? CURRENCIES[0];
}

export function formatCurrency(amount: number, currencyCode: string = 'INR', includeDecimals = true): string {
  const num = Number(amount);
  const info = getCurrencyInfo(currencyCode);
  const isNeg = num < 0;
  const abs = Math.abs(isNaN(num) ? 0 : num);
  const noDecimals = currencyCode === 'JPY' || !includeDecimals;

  if (currencyCode === 'INR') {
    const fmt = new Intl.NumberFormat('en-IN', {
      minimumFractionDigits: noDecimals ? 0 : 2,
      maximumFractionDigits: noDecimals ? 0 : 2,
    });
    return `${isNeg ? '-' : ''}${info.symbol}${fmt.format(abs)}`;
  }

  try {
    const fmt = new Intl.NumberFormat(info.locale, {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: noDecimals ? 0 : 2,
      maximumFractionDigits: noDecimals ? 0 : 2,
    });
    return fmt.format(isNaN(num) ? 0 : num);
  } catch {
    const fmt = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: noDecimals ? 0 : 2,
      maximumFractionDigits: noDecimals ? 0 : 2,
    });
    return `${isNeg ? '-' : ''}${info.symbol}${fmt.format(abs)}`;
  }
}

// Keep backward-compat alias — existing callers that haven't migrated still work
export function formatIndianCurrency(amount: number, includeDecimals = true): string {
  return formatCurrency(amount, 'INR', includeDecimals);
}

export function formatIndianNumberOnly(amount: number, includeDecimals = false): string {
  const num = Number(amount);
  if (isNaN(num)) return includeDecimals ? "0.00" : "0";
  const formatter = new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: includeDecimals ? 2 : 0,
    maximumFractionDigits: includeDecimals ? 2 : 0,
  });
  return formatter.format(num);
}

/**
 * Compresses an image file, resizing it dynamically to a maximum bounding box and converting to JPEG data URL.
 * Prevents localStorage quota limits from being exceeded.
 */
export function compressImage(file: File, maxWidth = 800, maxHeight = 600, quality = 0.7): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        resolve(dataUrl);
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
}

