import type { Period } from "../types/domain";

/** Faithful port of the old app's date/week helpers (js/10-calc-dates.js). */

export function parseDateOnly(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  const s = String(dateStr).trim();

  const buildSafeDate = (y: number, m: number, d: number): Date | null => {
    if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return null;
    const out = new Date(y, m, d);
    if (
      Number.isNaN(out.getTime()) ||
      out.getFullYear() !== y ||
      out.getMonth() !== m ||
      out.getDate() !== d
    ) {
      return null;
    }
    return out;
  };

  if (s.includes("-")) {
    const parts = s.split("-");
    if (parts.length === 3) {
      const y = Number(parts[0]);
      const m = Number(parts[1]) - 1;
      const d = Number(parts[2]);
      return buildSafeDate(y, m, d);
    }
  }

  if (s.includes("/")) {
    const parts = s.split("/");
    if (parts.length === 3) {
      const d = Number(parts[0]);
      const m = Number(parts[1]) - 1;
      const y = Number(parts[2]);
      return buildSafeDate(y, m, d);
    }
  }

  return null;
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function daysBetweenInclusive(a: Date, b: Date): number {
  const ms = startOfDay(b).getTime() - startOfDay(a).getTime();
  return Math.floor(ms / 86400000) + 1;
}

export function monthKeyFromDateObj(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function formatMonthKey(monthKey: string | null | undefined): string {
  if (!monthKey) return "No data";
  const [y, m] = monthKey.split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleString("en-US", { month: "long", year: "numeric" });
}

export function getMonthStart(monthKey: string): Date {
  const [y, m] = monthKey.split("-");
  return new Date(Number(y), Number(m) - 1, 1);
}

export function getMonthEnd(monthKey: string): Date {
  const [y, m] = monthKey.split("-");
  return new Date(Number(y), Number(m), 0);
}

export function getOverlapDaysInclusive(
  periodFrom: Date,
  periodTo: Date,
  monthStart: Date,
  monthEnd: Date
): number {
  const start = periodFrom > monthStart ? periodFrom : monthStart;
  const end = periodTo < monthEnd ? periodTo : monthEnd;
  if (start > end) return 0;
  return daysBetweenInclusive(start, end);
}

export function getDurationMonthsDays(
  from: Date,
  to: Date
): { months: number; days: number } {
  if (!from || !to) return { months: 0, days: 0 };
  const start = new Date(from);
  const end = new Date(to);
  if (start > end) return { months: 0, days: 0 };

  let months = 0;
  let temp = new Date(start);

  while (true) {
    const next = new Date(temp);
    next.setMonth(next.getMonth() + 1);
    if (next <= end) {
      temp = next;
      months++;
    } else {
      break;
    }
  }

  const days = Math.floor((end.getTime() - temp.getTime()) / 86400000);
  return { months, days };
}

export function formatDateForRange(date: Date | null): string {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  const d = String(date.getDate()).padStart(2, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
}

/**
 * Formats a stored ISO date string (as produced by <input type="date">,
 * e.g. "2026-01-31") for display as DD/MM/YYYY. Returns "—" for missing or
 * unparsable dates. This is the single source of truth for date display
 * everywhere in the app — the underlying stored/input value stays ISO.
 */
/**
 * Formats a stored ISO date string (as produced by <input type="date">,
 * e.g. "2026-01-31") for display as DD/MM/YYYY. Returns "—" for missing or
 * unparsable dates. This is the single source of truth for date display
 * everywhere in the app — the underlying stored/input value stays ISO.
 */
export function formatPeriodDate(iso: string | null | undefined): string {
  const parsed = parseDateOnly(iso);
  if (!parsed) return "—";
  return formatDateForRange(parsed);
}

/**
 * True if two inclusive date ranges overlap. Only meaningful when both
 * ranges are fully specified — a period with a missing from/to date isn't
 * checked (there's nothing reliable to compare).
 */
export function dateRangesOverlap(
  aFrom: string | null,
  aTo: string | null,
  bFrom: string | null,
  bTo: string | null
): boolean {
  if (!aFrom || !aTo || !bFrom || !bTo) return false;
  const aStart = parseDateOnly(aFrom);
  const aEnd = parseDateOnly(aTo);
  const bStart = parseDateOnly(bFrom);
  const bEnd = parseDateOnly(bTo);
  if (!aStart || !aEnd || !bStart || !bEnd) return false;
  return aStart <= bEnd && bStart <= aEnd;
}

export function getPeriodsDateRange(periods: Period[]): {
  min: Date | null;
  max: Date | null;
} {
  let min: Date | null = null;
  let max: Date | null = null;

  for (const p of periods) {
    const from = parseDateOnly(p.fromDate);
    const to = parseDateOnly(p.toDate);
    if (from && (!min || from < min)) min = from;
    if (to && (!max || to > max)) max = to;
  }

  return { min, max };
}

export function getAllMonthKeys(periods: Period[]): string[] {
  const keys = new Set<string>();

  for (const p of periods) {
    const from = parseDateOnly(p.fromDate);
    const to = parseDateOnly(p.toDate);
    if (!from || !to) continue;

    let cur = new Date(from.getFullYear(), from.getMonth(), 1);
    const last = new Date(to.getFullYear(), to.getMonth(), 1);

    while (cur <= last) {
      keys.add(monthKeyFromDateObj(cur));
      cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
    }
  }

  return [...keys].sort();
}

export function weeksBetweenRounded(from: Date, to: Date): number {
  if (!(from instanceof Date) || !(to instanceof Date) || from > to) return 0;
  const elapsedDays = Math.ceil(
    (startOfDay(to).getTime() - startOfDay(from).getTime()) / 86400000
  );
  if (elapsedDays <= 0) return 1;
  return Math.ceil(elapsedDays / 7);
}

/**
 * Merges overlapping/adjacent period date-ranges (that pass `predicate`) and
 * sums the resulting non-overlapping weeks. Matches calcCoveredWeeks exactly.
 */
export function calcCoveredWeeks(
  periods: Period[],
  predicate: (p: Period) => boolean
): number {
  const ranges = periods
    .filter(predicate)
    .map((p) => {
      const from = parseDateOnly(p.fromDate);
      const to = parseDateOnly(p.toDate);
      if (!from || !to || from > to) return null;
      return { from: startOfDay(from), to: startOfDay(to) };
    })
    .filter((r): r is { from: Date; to: Date } => r !== null)
    .sort((a, b) => a.from.getTime() - b.from.getTime());

  if (!ranges.length) return 0;

  let weeks = 0;
  let currentFrom = ranges[0].from;
  let currentTo = ranges[0].to;

  for (let i = 1; i < ranges.length; i++) {
    const range = ranges[i];
    const nextDayAfterCurrent = new Date(currentTo);
    nextDayAfterCurrent.setDate(nextDayAfterCurrent.getDate() + 1);

    if (range.from <= nextDayAfterCurrent) {
      if (range.to > currentTo) currentTo = range.to;
      continue;
    }

    weeks += weeksBetweenRounded(currentFrom, currentTo);
    currentFrom = range.from;
    currentTo = range.to;
  }

  weeks += weeksBetweenRounded(currentFrom, currentTo);
  return weeks;
}
