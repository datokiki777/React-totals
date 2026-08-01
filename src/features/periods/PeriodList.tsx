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

  if (!activeGroupId) {
    return <div className={styles.placeholder}>Select or create a group to add a period.</div>;
  }

  const firstPeriod = periods[0];

  function handleFabClick() {
    if (firstPeriod) {
      requestExpandPeriod(firstPeriod.id);
      addClientRow(firstPeriod.id);
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
        {firstPeriod ? "+ New Customer" : "+ New period"}
      </button>
    </div>
  );
}
