import { useMemo } from "react";
import { useAppStore } from "../../app/store";
import { PeriodCard } from "./PeriodCard";
import styles from "./PeriodList.module.css";

export function PeriodList() {
  const activeGroupId = useAppStore((s) => s.activeGroupId);
  const allPeriods = useAppStore((s) => s.periods);
  const addPeriod = useAppStore((s) => s.addPeriod);
  const addClientRow = useAppStore((s) => s.addClientRow);
  const requestExpandPeriod = useAppStore((s) => s.requestExpandPeriod);

  const periods = useMemo(
    () => allPeriods.filter((p) => p.groupId === activeGroupId),
    [allPeriods, activeGroupId]
  );

  // The FAB always targets the newest period (by From date; falls back to
  // whichever was created most recently if dates are missing/tied) —
  // not just whichever period happens to be first in the list.
  const newestPeriod = useMemo(() => {
    if (periods.length === 0) return undefined;
    return [...periods].sort((a, b) => {
      const aTime = a.fromDate ? Date.parse(a.fromDate) : -Infinity;
      const bTime = b.fromDate ? Date.parse(b.fromDate) : -Infinity;
      if (aTime !== bTime) return bTime - aTime;
      return b.createdAt - a.createdAt;
    })[0];
  }, [periods]);

  if (!activeGroupId) {
    return <div className={styles.placeholder}>Select or create a group to add a period.</div>;
  }

  function handleFabClick() {
    if (newestPeriod) {
      requestExpandPeriod(newestPeriod.id);
      addClientRow(newestPeriod.id);
    } else if (activeGroupId) {
      addPeriod(activeGroupId);
    }
  }

  return (
    <div className={styles.list}>
      {periods.length === 0 && (
        <div className={styles.placeholder}>This group has no periods yet.</div>
      )}
      {periods.map((p) => (
        <PeriodCard key={p.id} periodId={p.id} />
      ))}

      <button className={styles.fab} type="button" onClick={handleFabClick}>
        {newestPeriod ? "+ New Customer" : "+ New period"}
      </button>
    </div>
  );
}
