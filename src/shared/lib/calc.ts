import type { ClientRow, Period, PeriodTotals } from "../types/domain";

/**
 * "My €" — commission at the period's rate:
 * if the row has a Net amount entered, the rate applies to Net;
 * otherwise it applies to Gross.
 */
export function computeRowMy(row: ClientRow, ratePercent: number): number {
  const base = row.net > 0 ? row.net : row.gross;
  return base * (ratePercent / 100);
}

export function computePeriodTotals(period: Period, rows: ClientRow[]): PeriodTotals {
  const periodRows = rows.filter((r) => r.periodId === period.id);
  const gross = periodRows.reduce((sum, r) => sum + (r.gross || 0), 0);
  const net = periodRows.reduce((sum, r) => sum + (r.net || 0), 0);
  const myEur = periodRows.reduce(
    (sum, r) => sum + computeRowMy(r, period.defaultRate),
    0
  );
  return { gross, net, myEur };
}

export function formatMoney(n: number): string {
  return (n || 0).toFixed(2);
}
