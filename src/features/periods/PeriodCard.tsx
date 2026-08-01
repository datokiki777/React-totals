import { useEffect, useMemo, useState } from "react";
import { useAppStore } from "../../app/store";
import { computePeriodTotals, formatMoney } from "../../shared/lib/calc";
import { formatPeriodDate } from "../../shared/lib/dates";
import { ClientRowItem } from "../clients/ClientRowItem";
import styles from "./PeriodCard.module.css";

export function PeriodCard({ periodId }: { periodId: string }) {
  const period = useAppStore((s) => s.periods.find((p) => p.id === periodId));
  const group = useAppStore((s) =>
    period ? s.groups.find((g) => g.id === period.groupId) : undefined
  );
  const allClientRows = useAppStore((s) => s.clientRows);
  const updatePeriod = useAppStore((s) => s.updatePeriod);
  const removePeriod = useAppStore((s) => s.removePeriod);
  const addClientRow = useAppStore((s) => s.addClientRow);
  const confirmDestructive = useAppStore((s) => s.settings.confirmDestructiveActions);
  const expandPeriodId = useAppStore((s) => s.expandPeriodId);
  const clearExpandPeriodRequest = useAppStore((s) => s.clearExpandPeriodRequest);

  // Periods start collapsed by default (matching the old app), but if
  // Review/Search just navigated here for a specific row, force this
  // period open instead — otherwise the row it's trying to reveal would
  // stay hidden.
  const [collapsed, setCollapsed] = useState(() => expandPeriodId !== periodId);

  useEffect(() => {
    if (expandPeriodId === periodId) {
      setCollapsed(false);
      clearExpandPeriodRequest();
    }
  }, [expandPeriodId, periodId, clearExpandPeriodRequest]);

  const rows = useMemo(
    () => allClientRows.filter((r) => r.periodId === periodId),
    [allClientRows, periodId]
  );

  if (!period || !group) return null;

  const totals = computePeriodTotals(period, rows, group.defaultRate);

  function handleRemovePeriod() {
    if (confirmDestructive && !window.confirm("Delete this period and all its clients?")) return;
    removePeriod(periodId);
  }

  return (
    <section className={styles.card}>
      <button className={styles.collapseBtn} type="button" onClick={() => setCollapsed((v) => !v)}>
        <span>Period</span>
        <span className={styles.meta}>
          {formatPeriodDate(period.fromDate)} → {formatPeriodDate(period.toDate)}
        </span>
        <span>{collapsed ? "▸" : "▾"}</span>
      </button>

      {!collapsed && (
        <>
          <div className={styles.head}>
            <label className={styles.field}>
              <span>From</span>
              <input
                type="date"
                value={period.fromDate ?? ""}
                onChange={(e) => updatePeriod(period.id, { fromDate: e.target.value || null })}
              />
            </label>
            <label className={styles.field}>
              <span>To</span>
              <input
                type="date"
                value={period.toDate ?? ""}
                onChange={(e) => updatePeriod(period.id, { toDate: e.target.value || null })}
              />
            </label>
            <label className={styles.field}>
              <span>Paid weeks</span>
              <input
                type="text"
                inputMode="numeric"
                placeholder="0"
                value={period.paidWeeks ?? ""}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, "");
                  updatePeriod(period.id, { paidWeeks: digits === "" ? null : Number(digits) });
                }}
              />
            </label>
            <div className={styles.actions}>
              <button className={styles.btnPrimary} type="button" onClick={() => addClientRow(period.id)}>
                + Client
              </button>
              <button className={styles.btnDanger} type="button" onClick={handleRemovePeriod}>
                Delete period
              </button>
            </div>
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Gross</th>
                  <th>Net</th>
                  <th>City</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <ClientRowItem key={row.id} rowId={row.id} />
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td className={styles.totalLabel}>Total</td>
                  <td data-testid="period-total-gross">{formatMoney(totals.gross)}</td>
                  <td data-testid="period-total-net">{formatMoney(totals.net)}</td>
                  <td colSpan={3}>
                    My €: <b data-testid="period-total-my-eur">{formatMoney(totals.myEur)}</b>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
