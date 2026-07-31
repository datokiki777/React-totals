import { useMemo, useState } from "react";
import { useAppStore } from "../../app/store";
import { formatMoney } from "../../shared/lib/calc";
import { parseMoney } from "../../shared/lib/money";
import styles from "./ReviewSearch.module.css";

export function ReviewSearch() {
  const [query, setQuery] = useState("");
  const groups = useAppStore((s) => s.groups);
  const periods = useAppStore((s) => s.periods);
  const clientRows = useAppStore((s) => s.clientRows);

  const groupById = useMemo(() => new Map(groups.map((g) => [g.id, g])), [groups]);
  const periodById = useMemo(() => new Map(periods.map((p) => [p.id, p])), [periods]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return clientRows
      .filter(
        (r) =>
          r.customer.toLowerCase().includes(q) || r.city.toLowerCase().includes(q)
      )
      .map((r) => {
        const period = periodById.get(r.periodId);
        const group = period ? groupById.get(period.groupId) : undefined;
        return { row: r, period, group };
      })
      .sort((a, b) => b.row.updatedAt - a.row.updatedAt)
      .slice(0, 100);
  }, [query, clientRows, periodById, groupById]);

  return (
    <div className={styles.wrap}>
      <input
        className={styles.searchInput}
        type="text"
        placeholder="მოძებნე კლიენტი სახელით ან ქალაქით..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {query.trim() && (
        <div className={styles.results}>
          {results.length === 0 && (
            <div className={styles.empty}>ვერაფერი მოიძებნა.</div>
          )}
          {results.map(({ row, period, group }) => (
            <div key={row.id} className={styles.resultCard}>
              <div className={styles.resultHead}>
                <span className={styles.customer}>{row.customer || "—"}</span>
                <span className={styles.status}>{row.status}</span>
              </div>
              <div className={styles.resultMeta}>
                {group?.name ?? "—"} · {period?.fromDate ?? "—"} → {period?.toDate ?? "—"}
                {row.city && ` · ${row.city}`}
              </div>
              <div className={styles.resultNumbers}>
                <span>Gross: {formatMoney(parseMoney(row.gross) || 0)}</span>
                <span>Net: {formatMoney(parseMoney(row.net) || 0)}</span>
              </div>
              {row.comment && <div className={styles.comment}>{row.comment}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
