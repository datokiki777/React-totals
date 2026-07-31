import { useState } from "react";
import { useAppStore } from "../../app/store";
import { computePeriodTotals, formatMoney } from "../../shared/lib/calc";
import { ClientRowItem } from "../clients/ClientRowItem";
import styles from "./PeriodCard.module.css";

export function PeriodCard({ periodId }: { periodId: string }) {
  const period = useAppStore((s) => s.periods.find((p) => p.id === periodId));
  const rows = useAppStore((s) => s.clientRows.filter((r) => r.periodId === periodId));
  const updatePeriod = useAppStore((s) => s.updatePeriod);
  const removePeriod = useAppStore((s) => s.removePeriod);
  const addClientRow = useAppStore((s) => s.addClientRow);
  const [collapsed, setCollapsed] = useState(false);

  if (!period) return null;

  const totals = computePeriodTotals(period, rows);

  return (
    <section className={styles.card}>
      <button className={styles.collapseBtn} type="button" onClick={() => setCollapsed((v) => !v)}>
        <span>პერიოდი</span>
        <span className={styles.meta}>
          {period.fromDate || "—"} → {period.toDate || "—"}
        </span>
        <span>{collapsed ? "▸" : "▾"}</span>
      </button>

      {!collapsed && (
        <>
          <div className={styles.head}>
            <label className={styles.field}>
              <span>დან</span>
              <input
                type="date"
                value={period.fromDate ?? ""}
                onChange={(e) => updatePeriod(period.id, { fromDate: e.target.value || null })}
              />
            </label>
            <label className={styles.field}>
              <span>მდე</span>
              <input
                type="date"
                value={period.toDate ?? ""}
                onChange={(e) => updatePeriod(period.id, { toDate: e.target.value || null })}
              />
            </label>
            <label className={styles.field}>
              <span>%</span>
              <input
                type="number"
                step="0.01"
                value={period.defaultRate}
                onChange={(e) => updatePeriod(period.id, { defaultRate: Number(e.target.value) })}
              />
            </label>
            <div className={styles.actions}>
              <button className={styles.btnPrimary} type="button" onClick={() => addClientRow(period.id)}>
                + კლიენტი
              </button>
              <button className={styles.btnDanger} type="button" onClick={() => removePeriod(period.id)}>
                პერიოდის წაშლა
              </button>
            </div>
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>კლიენტი</th>
                  <th>Gross</th>
                  <th>Net</th>
                  <th>ქალაქი</th>
                  <th>სტატუსი</th>
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
                  <td className={styles.totalLabel}>ჯამი</td>
                  <td>{formatMoney(totals.gross)}</td>
                  <td>{formatMoney(totals.net)}</td>
                  <td colSpan={3}>
                    My €: <b>{formatMoney(totals.myEur)}</b>
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
