/**
 * Faithful port of the old app's parseMoney(): accepts flexible text input
 * ("1.234,56", "1,234.56", "1234", "12,5", etc.) and returns a finite number,
 * or NaN if the text isn't a usable number.
 */
export function parseMoney(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return NaN;

  let s = String(value).trim();
  if (!s) return NaN;

  s = s.replace(/\s/g, "");

  if (s.includes(",") && s.includes(".")) {
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) {
      // European format: 1.234,56
      s = s.replace(/\./g, "");
      s = s.replace(",", ".");
    } else {
      // US format: 1,234.56
      s = s.replace(/,/g, "");
    }
  } else if (s.includes(",")) {
    const parts = s.split(",");
    if (parts.length === 2 && parts[1].length <= 2) {
      // decimal comma: 123,45
      s = s.replace(",", ".");
    } else {
      // thousands separator: 1,234
      s = s.replace(/,/g, "");
    }
  } else if (s.includes(".")) {
    const parts = s.split(".");
    if (parts.length > 2) {
      // 1.234.567 -> remove all dots
      s = s.replace(/\./g, "");
    } else if (parts.length === 2 && parts[1].length === 3) {
      // 1.234 -> thousands separator
      s = s.replace(".", "");
    }
  }

  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

/** Same clamp the old app applies to rate percentages at calc time. */
export function clampRate(percent: number): number {
  let p = Number(percent);
  if (!Number.isFinite(p)) p = 0;
  if (p < 0) p = 0;
  if (p > 100) p = 100;
  return p;
}

/**
 * Formats an already-computed amount with a display currency symbol.
 * Purely presentational — the underlying stored/calculated number is never
 * changed by this; only how it's shown changes.
 */
export function formatCurrency(formattedAmount: string, symbol: string): string {
  return `${symbol}${formattedAmount}`;
}
