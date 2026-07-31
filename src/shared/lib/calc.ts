import type { ClientRow, Period, PeriodTotals } from "../types/domain";
import { parseMoney, clampRate } from "./money";

/**
 * Faithful port of the old app's calcPeriodTotals() (js/12-calc-totals.js):
 *
 * - Rows marked "wrong" are excluded entirely from every total.
 * - Gross/Net are free-text; "" (not entered) is different from "0" (entered).
 * - "My €" per row = (Net if entered, else Gross if entered, else 0) * rate.
 */
export function computePeriodTotals(period: Period, rows: ClientRow[]): PeriodTotals {
  const rate = clampRate(period.defaultRate) / 100;
  const periodRows = rows.filter((r) => r.periodId === period.id);

  let gross = 0;
  let net = 0;
  let myEur = 0;

  for (const row of periodRows) {
    if (row.status === "wrong") continue;

    const grossRaw = row.gross.trim();
    const netRaw = row.net.trim();
    const hasGross = grossRaw !== "";
    const hasNet = netRaw !== "";

    if (!hasGross && !hasNet) continue;

    const grossVal = hasGross ? parseMoney(grossRaw) : 0;
    const netVal = hasNet ? parseMoney(netRaw) : 0;

    if (Number.isFinite(grossVal)) gross += grossVal;
    if (Number.isFinite(netVal)) net += netVal;

    let base = 0;
    if (hasNet && Number.isFinite(netVal)) {
      base = netVal;
    } else if (hasGross && Number.isFinite(grossVal)) {
      base = grossVal;
    }
    myEur += base * rate;
  }

  return { gross, net, myEur };
}

export function formatMoney(n: number): string {
  return (n || 0).toFixed(2);
}
