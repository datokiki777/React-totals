import { useAppStore } from "../../app/store";
import { PeriodCard } from "./PeriodCard";
import styles from "./PeriodList.module.css";

export function PeriodList() {
  const activeGroupId = useAppStore((s) => s.activeGroupId);
  const periods = useAppStore((s) =>
    s.periods.filter((p) => p.groupId === activeGroupId && !p.archived)
  );
  const addPeriod = useAppStore((s) => s.addPeriod);

  if (!activeGroupId) {
    return <div className={styles.placeholder}>აირჩიე ან შექმენი ჯგუფი, რომ დაამატო პერიოდი.</div>;
  }

  return (
    <div className={styles.list}>
      {periods.length === 0 && (
        <div className={styles.placeholder}>ამ ჯგუფში პერიოდები არ არის.</div>
      )}
      {periods.map((p) => (
        <PeriodCard key={p.id} periodId={p.id} />
      ))}
      <button
        className={styles.addPeriodBtn}
        type="button"
        onClick={() => addPeriod(activeGroupId)}
      >
        + ახალი პერიოდი
      </button>
    </div>
  );
}
