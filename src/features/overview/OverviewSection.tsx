import { useMemo, useState } from "react";
import { useAppStore } from "../../app/store";
import { computePeriodTotals, formatMoney } from "../../shared/lib/calc";
import { monthKey, monthLabel, periodMonthKey } from "../../shared/lib/month";
import type { DoneStatus } from "../../shared/types/domain";
import styles from "./OverviewSection.module.css";

type Scope = "current" | "all";

export function OverviewSection() {
  const activeGroupId = useAppStore((s) => s.activeGroupId);
  const allPeriods = useAppStore((s) => s.periods);
  const clientRows = useAppStore((s) => s.clientRows);

  const [scope, setScope] = useState<Scope>("current");
  const [monthOffset, setMonthOffset] = useState(0);

  const scopedPeriods = useMemo(
    () =>
      allPeriods.filter((p) => {
        if (p.archived) return false;
        return scope === "current" ? p.groupId === activeGroupId : true;
      }),
    [allPeriods, scope, activeGroupId]
  );

  const scopedPeriodIds = useMemo(
    () => new Set(scopedPeriods.map((p) => p.id)),
    [scopedPeriods]
  );

  const scopedRows = useMemo(
    () => clientRows.filter((r) => scopedPeriodIds.has(r.periodId)),
    [clientRows, scopedPeriodIds]
  );

  const totals = useMemo(
    () =>
      scopedPeriods.reduce(
        (acc, p) => {
          const t = computePeriodTotals(p, clientRows);
          acc.gross += t.gross;
          acc.net += t.net;
          acc.myEur += t.myEur;
          return acc;
        },
        { gross: 0, net: 0, myEur: 0 }
      ),
    [scopedPeriods, clientRows]
  );

  const statusCounts = useMemo(() => {
    const counts: Record<DoneStatus, number> = {
      none: 0,
      done: 0,
      fail: 0,
      fixed: 0,
      wrong: 0,
    };
    for (const row of scopedRows) counts[row.status]++;
    return counts;
  }, [scopedRows]);

  const now = new Date();
  const targetDate = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const targetKey = monthKey(targetDate.getFullYear(), targetDate.getMonth());

  const monthTotals = useMemo(() => {
    const monthPeriods = scopedPeriods.filter((p) => periodMonthKey(p) === targetKey);
    return monthPeriods.reduce(
      (acc, p) => {
        const t = computePeriodTotals(p, clientRows);
        acc.gross += t.gross;
        acc.net += t.net;
        acc.myEur += t.myEur;
        return acc;
      },
      { gross: 0, net: 0, myEur: 0 }
    );
  }, [scopedPeriods, clientRows, targetKey]);

  return (
    <section className={styles.card}>
      <div className={styles.head}>
        <div className={styles.title}>📊 Overview</div>
        <div className={styles.toggle}>
          <button
            className={scope === "current" ? styles.toggleBtnActive : styles.toggleBtn}
            onClick={() => setScope("current")}
          >
            Current
          </button>
          <button
            className={scope === "all" ? styles.toggleBtnActive : styles.toggleBtn}
            onClick={() => setScope("all")}
          >
            All
          </button>
        </div>
      </div>

      <div className={styles.grid}>
        <div className={styles.kpi}>
          <div className={styles.label}>Gross</div>
          <div className={styles.value}>{formatMoney(totals.gross)}</div>
        </div>
        <div className={styles.kpi}>
          <div className={styles.label}>Net</div>
          <div className={styles.value}>{formatMoney(totals.net)}</div>
        </div>
        <div className={styles.kpi}>
          <div className={styles.label}>My €</div>
          <div className={styles.value}>{formatMoney(totals.myEur)}</div>
        </div>
      </div>

      <div className={styles.statusRow}>
        <span>Done / Fail / Fixed / Wrong</span>
        <div className={styles.badges}>
          <span className={styles.badgeDone}>{statusCounts.done}</span>
          <span className={styles.badgeFail}>{statusCounts.fail}</span>
          <span className={styles.badgeFixed}>{statusCounts.fixed}</span>
          <span className={styles.badgeWrong}>{statusCounts.wrong}</span>
        </div>
      </div>

      <div className={styles.monthly}>
        <div className={styles.monthlyHead}>
          <span>Monthly · Statistics</span>
          <div className={styles.monthNav}>
            <button onClick={() => setMonthOffset((v) => v - 1)}>‹</button>
            <span>{monthLabel(targetDate.getFullYear(), targetDate.getMonth())}</span>
            <button onClick={() => setMonthOffset((v) => v + 1)}>›</button>
          </div>
        </div>
        <div className={styles.monthlyGrid}>
          <div className={styles.monthRow}>
            <span>Month Gross</span>
            <b>{formatMoney(monthTotals.gross)}</b>
          </div>
          <div className={styles.monthRow}>
            <span>Month Net</span>
            <b>{formatMoney(monthTotals.net)}</b>
          </div>
          <div className={styles.monthRow}>
            <span>Month My €</span>
            <b>{formatMoney(monthTotals.myEur)}</b>
          </div>
        </div>
      </div>
    </section>
  );
}
