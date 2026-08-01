import { useMemo } from "react";
import { useAppStore } from "../../app/store";
import { PeriodCard } from "./PeriodCard";
import styles from "./PeriodList.module.css";

export function PeriodList() {
  const activeGroupId = useAppStore((s) => s.activeGroupId);
  const allPeriods = useAppStore((s) => s.periods);
  const addPeriod = useAppStore((s) => s.addPeriod);

  const periods = useMemo(
    () => allPeriods.filter((p) => p.groupId === activeGroupId),
    [allPeriods, activeGroupId]
  );

  if (!activeGroupId) {
    return <div className={styles.placeholder}>Select or create a group to add a period.</div>;
  }

  return (
    <div className={styles.list}>
      {periods.length === 0 && (
        <div className={styles.placeholder}>This group has no periods yet.</div>
      )}
      {periods.map((p) => (
        <PeriodCard key={p.id} periodId={p.id} />
      ))}
      <button
        className={styles.addPeriodBtn}
        type="button"
        onClick={() => addPeriod(activeGroupId)}
      >
        + New period
      </button>
    </div>
  );
}
