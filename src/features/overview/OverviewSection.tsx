import { useEffect, useMemo, useState } from "react";
import { useAppStore } from "../../app/store";
import {
  computeGrandTotals,
  computeMarkedClientsCount,
  computeMonthlyTotals,
  computeStatusCounts,
  formatMoney,
} from "../../shared/lib/calc";
import {
  formatDateForRange,
  formatMonthKey,
  getAllMonthKeys,
  getDurationMonthsDays,
  getPeriodsDateRange,
} from "../../shared/lib/dates";
import type { Group } from "../../shared/types/domain";
import styles from "./OverviewSection.module.css";

type Scope = "current" | "all";

export function OverviewSection() {
  const workspace = useAppStore((s) => s.workspace);
  const activeGroupId = useAppStore((s) => s.activeGroupId);
  const allGroups = useAppStore((s) => s.groups);
  const allPeriods = useAppStore((s) => s.periods);
  const clientRows = useAppStore((s) => s.clientRows);

  const [scope, setScope] = useState<Scope>("current");
  const [monthIndex, setMonthIndex] = useState<number | null>(null);

  // Groups visible in the current workspace tab (Active / Archive).
  const workspaceGroups = useMemo(
    () => allGroups.filter((g) => (workspace === "archive" ? g.archived : !g.archived)),
    [allGroups, workspace]
  );

  // Groups this Overview actually reports on: just the active one ("Current"),
  // or every group in this workspace tab ("All") — matches getGroupsByMode().
  const scopedGroups: Group[] = useMemo(() => {
    if (scope === "all") return workspaceGroups;
    const current = workspaceGroups.find((g) => g.id === activeGroupId);
    return current ? [current] : [];
  }, [scope, workspaceGroups, activeGroupId]);

  const scopedGroupIds = useMemo(() => new Set(scopedGroups.map((g) => g.id)), [scopedGroups]);

  const scopedPeriods = useMemo(
    () => allPeriods.filter((p) => scopedGroupIds.has(p.groupId)),
    [allPeriods, scopedGroupIds]
  );

  const scopedPeriodIds = useMemo(
    () => new Set(scopedPeriods.map((p) => p.id)),
    [scopedPeriods]
  );

  const scopedRows = useMemo(
    () => clientRows.filter((r) => scopedPeriodIds.has(r.periodId)),
    [clientRows, scopedPeriodIds]
  );

  // --- Grand totals (Gross / Net / My€ / Unpaid / Income) ---
  const grand = useMemo(
    () => computeGrandTotals(scopedGroups, scopedPeriods, clientRows),
    [scopedGroups, scopedPeriods, clientRows]
  );

  // --- Status badges: plain counts over the scope, NOT month-filtered
  // (this matches the old app's actual render behavior exactly). ---
  const statusCounts = useMemo(() => computeStatusCounts(scopedRows), [scopedRows]);

  // --- Date range / duration / marked-clients widget ---
  const { min, max } = useMemo(() => getPeriodsDateRange(scopedPeriods), [scopedPeriods]);
  const clientsCount = useMemo(() => computeMarkedClientsCount(scopedRows), [scopedRows]);
  const duration = min && max ? getDurationMonthsDays(min, max) : null;

  // --- Monthly stats: month navigation over the months that actually have
  // period data in this scope, defaulting to the most recent one. ---
  const monthKeys = useMemo(() => getAllMonthKeys(scopedPeriods), [scopedPeriods]);

  useEffect(() => {
    // Keep the cursor valid whenever the available months change (scope
    // switch, workspace switch, or a period's dates changing) — snap to the
    // last month, exactly like the old app's getCurrentMonthKey() default.
    setMonthIndex(monthKeys.length ? monthKeys.length - 1 : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthKeys.join(",")]);

  const currentMonthKey = monthIndex !== null ? monthKeys[monthIndex] ?? null : null;

  const monthTotals = useMemo(
    () => computeMonthlyTotals(currentMonthKey, scopedGroups, scopedPeriods, clientRows),
    [currentMonthKey, scopedGroups, scopedPeriods, clientRows]
  );

  const canGoPrev = monthIndex !== null && monthIndex > 0;
  const canGoNext = monthIndex !== null && monthIndex < monthKeys.length - 1;

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
          <div className={styles.value}>{formatMoney(grand.gross)}</div>
        </div>
        <div className={styles.kpi}>
          <div className={styles.label}>Net</div>
          <div className={styles.value}>{formatMoney(grand.net)}</div>
        </div>
        <div className={styles.kpi}>
          <div className={styles.label}>My €</div>
          <div className={styles.value}>{formatMoney(grand.myEur)}</div>
        </div>
      </div>

      <div className={styles.pillRow}>
        <span className={styles.pill}>
          <span>Unpaid</span>
          <b>{formatMoney(grand.unpaid)}</b>
        </span>
        <span className={styles.pill}>
          <span>Income</span>
          <b>{formatMoney(grand.income)}</b>
        </span>
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

      <div className={styles.dateBox}>
        <div className={styles.dateRow}>
          <span className={styles.dateLabel}>Working period</span>
          <span className={styles.durationBadge}>
            {duration ? `${duration.months} Mo ${duration.days} D` : "—"}
          </span>
          <span className={styles.durationBadge}>{clientsCount} Clients</span>
        </div>
        <div className={styles.dateValue}>
          {min && max ? `${formatDateForRange(min)} → ${formatDateForRange(max)}` : "—"}
        </div>
      </div>

      <div className={styles.monthly}>
        <div className={styles.monthlyHead}>
          <span>Monthly · Statistics</span>
          <div className={styles.monthNav}>
            <button
              disabled={!canGoPrev}
              onClick={() => setMonthIndex((i) => (i !== null ? i - 1 : i))}
            >
              ‹
            </button>
            <span>{formatMonthKey(currentMonthKey)}</span>
            <button
              disabled={!canGoNext}
              onClick={() => setMonthIndex((i) => (i !== null ? i + 1 : i))}
            >
              ›
            </button>
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
