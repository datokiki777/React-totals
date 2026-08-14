import { useEffect, useMemo, useState } from "react";
import { useAppStore } from "../../app/store";
import { computePeriodTotals, formatMoney } from "../../shared/lib/calc";
import { formatPeriodDate, dateRangesOverlap } from "../../shared/lib/dates";
import { confirmDialog } from "../../shared/modal/modalStore";
import { getPeriodById, getGroupById } from "../../shared/lib/entityLookup";
import { ClientRowItem } from "../clients/ClientRowItem";
import styles from "./PeriodCard.module.css";

export function PeriodCard({ periodId }: { periodId: string }) {
  const period = useAppStore((s) => getPeriodById(s.periods, periodId));
  const group = useAppStore((s) => (period ? getGroupById(s.groups, period.groupId) : undefined));
  const allPeriods = useAppStore((s) => s.periods);
  const allClientRows = useAppStore((s) => s.clientRows);
  const updatePeriod = useAppStore((s) => s.updatePeriod);
  const removePeriod = useAppStore((s) => s.removePeriod);
  const addPeriod = useAppStore((s) => s.addPeriod);
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

  async function handleRemovePeriod() {
    if (
      confirmDestructive &&
      !(await confirmDialog("Delete this period and all its clients?", { danger: true }))
    ) {
      return;
    }
    removePeriod(periodId);
  }

  async function handleDateChange(field: "fromDate" | "toDate", value: string) {
    if (!period) return;
    const nextValue = value || null;
    const nextFrom = field === "fromDate" ? nextValue : period.fromDate;
    const nextTo = field === "toDate" ? nextValue : period.toDate;

    const overlapsWith = allPeriods.find(
      (p) =>
        p.id !== period.id &&
        p.groupId === period.groupId &&
        dateRangesOverlap(nextFrom, nextTo, p.fromDate, p.toDate)
    );

    if (overlapsWith) {
      const label = `${formatPeriodDate(overlapsWith.fromDate)} → ${formatPeriodDate(overlapsWith.toDate)}`;
      const proceed = await confirmDialog(
        `This date range overlaps with another period in this group (${label}). Continue anyway?`
      );
      if (!proceed) return;
    }

    updatePeriod(period.id, { [field]: nextValue });
  }

  return (
    <section className={styles.card}>
      <button className={styles.collapseBtn} type="button" data-testid="period-collapse-btn" onClick={() => setCollapsed((v) => !v)}>
        <span className={styles.collapseBtnLead}>
          <span className={styles.collapseBtnTitle}>Period</span>
          <span className={styles.groupTag}>{group.name}</span>
        </span>
        <span className={styles.meta}>
          {formatPeriodDate(period.fromDate)} → {formatPeriodDate(period.toDate)}
        </span>
        <span className={styles.chevron}>{collapsed ? "▸" : "▾"}</span>
      </button>

      {!collapsed && (
        <>
          <div className={styles.body}>
            <h3 className={styles.sectionTitle}>Period</h3>

            <div className={styles.topFields}>
              <span className={styles.groupPill}>Group: {group.name}</span>
              <label className={styles.field}>
                <span>Paid Weeks</span>
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
            </div>

            <div className={styles.dateFields}>
              <label className={styles.field}>
                <span>From</span>
                <input
                  type="date"
                  value={period.fromDate ?? ""}
                  onChange={(e) => handleDateChange("fromDate", e.target.value)}
                />
              </label>
              <label className={styles.field}>
                <span>To</span>
                <input
                  type="date"
                  value={period.toDate ?? ""}
                  onChange={(e) => handleDateChange("toDate", e.target.value)}
                />
              </label>
            </div>

            <div className={styles.actions}>
              <button className={styles.btnPrimary} type="button" onClick={() => addClientRow(period.id)}>
                + Add client
              </button>
              <button className={styles.btnDanger} type="button" onClick={handleRemovePeriod}>
                Remove period
              </button>
              <button
                className={styles.btnSecondary}
                type="button"
                onClick={() => addPeriod(period.groupId)}
              >
                + Add period
              </button>
            </div>
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Gross</th>
                  <th>Net</th>
                  <th>City</th>
                  <th>Date</th>
                  <th>Done</th>
                  <th>Actions</th>
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
