import { useEffect, useMemo, useRef, useState } from "react";
import { useAppStore } from "../../app/store";
import { buildSearchIndex, searchIndex, highlightParts, type SearchIndexItem } from "../../shared/lib/search";
import styles from "./ReviewSearch.module.css";

const STATUS_LABEL: Record<string, string> = {
  done: "Done",
  fail: "Fail",
  fixed: "Fixed",
  wrong: "Wrong",
};

function Highlighted({ text, query }: { text: string; query: string }) {
  const parts = highlightParts(text, query);
  return (
    <>
      {parts.map((p, i) =>
        p.match ? <mark key={i} className={styles.mark}>{p.text}</mark> : <span key={i}>{p.text}</span>
      )}
    </>
  );
}

export function ReviewSearch() {
  const [query, setQuery] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);

  const groups = useAppStore((s) => s.groups);
  const periods = useAppStore((s) => s.periods);
  const clientRows = useAppStore((s) => s.clientRows);
  const setMode = useAppStore((s) => s.setMode);
  const setWorkspace = useAppStore((s) => s.setWorkspace);
  const setActiveGroup = useAppStore((s) => s.setActiveGroup);
  const highlightRow = useAppStore((s) => s.highlightRow);
  const requestExpandPeriod = useAppStore((s) => s.requestExpandPeriod);

  const index = useMemo(() => buildSearchIndex(groups, periods, clientRows), [groups, periods, clientRows]);
  const results = useMemo(() => searchIndex(index, query), [index, query]);

  // Click outside the search box clears it, matching the old app's pointerdown handler.
  useEffect(() => {
    function handlePointerDown(e: PointerEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setQuery("");
      }
    }
    document.addEventListener("pointerdown", handlePointerDown, { passive: true });
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") setQuery("");
  }

  function handleOpenInEdit(item: SearchIndexItem) {
    if (!window.confirm("Open this client in Edit mode?")) return;

    setQuery("");
    setWorkspace(item.groupArchived ? "archive" : "active");
    setActiveGroup(item.groupId);
    requestExpandPeriod(item.periodId);
    setMode("edit");

    // Give the edit view a moment to render the target group/period before
    // scrolling to and highlighting the row.
    setTimeout(() => {
      const rowEl = document.querySelector(`tr[data-row-id="${item.rowId}"]`);
      rowEl?.scrollIntoView({ behavior: "smooth", block: "center" });
      highlightRow(item.rowId);
    }, 80);
  }

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <input
        className={styles.searchInput}
        type="text"
        placeholder="Search client by name, address, or note..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        autoComplete="off"
      />

      {query.trim() && (
        <div className={styles.results}>
          {results.length === 0 && <div className={styles.empty}>No results</div>}
          {results.map((item) => (
            <button
              key={item.rowId}
              type="button"
              className={styles.resultCard}
              onClick={() => handleOpenInEdit(item)}
            >
              <div className={styles.resultHead}>
                <span className={styles.customer}>
                  {item.groupArchived && "📦 "}
                  <Highlighted text={item.customer || "Client"} query={query} />
                </span>
                {item.status !== "none" && (
                  <span className={styles[`status_${item.status}`]}>{STATUS_LABEL[item.status]}</span>
                )}
              </div>
              <div className={styles.resultMeta}>
                <span>
                  <b>Group:</b> {item.groupArchived && "📦 "}
                  {item.groupName}
                </span>
                <span>
                  <b>Period:</b> {item.from} → {item.to}
                </span>
                <span>
                  <b>City:</b> <Highlighted text={item.city || "—"} query={query} />
                </span>
                <span>
                  <b>Gross:</b> {item.gross}
                </span>
                <span>
                  <b>Net:</b> {item.net}
                </span>
              </div>
              {item.comment && (
                <div className={styles.comment}>
                  <Highlighted text={item.comment} query={query} />
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
