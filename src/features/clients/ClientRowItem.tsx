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
  const isHighlighted = useAppStore((s) => s.highlightedRowId === rowId);
  const confirmDestructive = useAppStore((s) => s.settings.confirmDestructiveActions);
  const [commentOpen, setCommentOpen] = useState(false);

  if (!row) return null;

  function handleRemove() {
    if (!row) return;
    if (
      confirmDestructive &&
      (row.customer || row.gross || row.net || row.city || row.comment) &&
      !window.confirm(`Delete client "${row.customer || "Unnamed"}"?`)
    ) {
      return;
    }
    removeRow(row.id);
  }

  return (
    <tr
      data-row-id={row.id}
      className={
        [row.status === "wrong" && styles.wrongRow, isHighlighted && styles.highlighted]
          .filter(Boolean)
          .join(" ") || undefined
      }
    >
      <td data-label="Client">
        <input
          className={styles.input}
          value={row.customer}
          placeholder="Client name"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="words"
          spellCheck={false}
          onChange={(e) => updateRow(row.id, { customer: e.target.value })}
        />
        <button
          className={styles.commentToggle}
          type="button"
          onClick={() => setCommentOpen((v) => !v)}
        >
          ✎ {row.comment ? "Note" : "Add note"}
        </button>
        {commentOpen && (
          <textarea
            className={styles.commentInput}
            rows={2}
            maxLength={1000}
            placeholder="Private note for this client..."
            value={row.comment}
            onChange={(e) => updateRow(row.id, { comment: e.target.value })}
          />
        )}
      </td>
      <td data-label="Gross">
        <input
          className={styles.input}
          type="text"
          inputMode="decimal"
          value={row.gross}
          placeholder="0"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          onChange={(e) => updateRow(row.id, { gross: e.target.value })}
        />
      </td>
      <td data-label="Net">
        <input
          className={styles.input}
          type="text"
          inputMode="decimal"
          value={row.net}
          placeholder="0"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          onChange={(e) => updateRow(row.id, { net: e.target.value })}
        />
      </td>
      <td data-label="City">
        <input
          className={styles.input}
          value={row.city}
          placeholder="City"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="words"
          spellCheck={false}
          onChange={(e) => updateRow(row.id, { city: e.target.value })}
        />
      </td>
      <td data-label="Status">
        <button
          className={styles[`status_${row.status}`]}
          type="button"
          onClick={() => cycleStatus(row.id)}
        >
          {STATUS_LABEL[row.status]}
        </button>
      </td>
      <td data-label="">
        <button className={styles.removeBtn} type="button" onClick={handleRemove}>
          Delete
        </button>
      </td>
    </tr>
  );
}
