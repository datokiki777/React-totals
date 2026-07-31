import { useState } from "react";
import { useAppStore } from "../../app/store";
import type { DoneStatus } from "../../shared/types/domain";
import styles from "./ClientRowItem.module.css";

const STATUS_LABEL: Record<DoneStatus, string> = {
  none: "—",
  done: "✓ Done",
  fail: "✕ Fail",
  fixed: "⟳ Fixed",
  wrong: "! Wrong",
};

export function ClientRowItem({ rowId }: { rowId: string }) {
  const row = useAppStore((s) => s.clientRows.find((r) => r.id === rowId));
  const updateRow = useAppStore((s) => s.updateClientRow);
  const removeRow = useAppStore((s) => s.removeClientRow);
  const cycleStatus = useAppStore((s) => s.cycleRowStatus);
  const [commentOpen, setCommentOpen] = useState(false);

  if (!row) return null;

  return (
    <tr>
      <td>
        <input
          className={styles.input}
          value={row.customer}
          placeholder="კლიენტის სახელი"
          onChange={(e) => updateRow(row.id, { customer: e.target.value })}
        />
        <button
          className={styles.commentToggle}
          type="button"
          onClick={() => setCommentOpen((v) => !v)}
        >
          ✎ {row.comment ? "შენიშვნა" : "დამატება"}
        </button>
        {commentOpen && (
          <textarea
            className={styles.commentInput}
            rows={2}
            maxLength={1000}
            placeholder="პირადი შენიშვნა ამ კლიენტზე..."
            value={row.comment}
            onChange={(e) => updateRow(row.id, { comment: e.target.value })}
          />
        )}
      </td>
      <td>
        <input
          className={styles.input}
          type="number"
          value={row.gross || ""}
          placeholder="0"
          onChange={(e) => updateRow(row.id, { gross: Number(e.target.value) })}
        />
      </td>
      <td>
        <input
          className={styles.input}
          type="number"
          value={row.net || ""}
          placeholder="0"
          onChange={(e) => updateRow(row.id, { net: Number(e.target.value) })}
        />
      </td>
      <td>
        <input
          className={styles.input}
          value={row.city}
          placeholder="ქალაქი"
          onChange={(e) => updateRow(row.id, { city: e.target.value })}
        />
      </td>
      <td>
        <button
          className={styles[`status_${row.status}`]}
          type="button"
          onClick={() => cycleStatus(row.id)}
        >
          {STATUS_LABEL[row.status]}
        </button>
      </td>
      <td>
        <button className={styles.removeBtn} type="button" onClick={() => removeRow(row.id)}>
          წაშლა
        </button>
      </td>
    </tr>
  );
}
