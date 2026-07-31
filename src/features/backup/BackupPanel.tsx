import { useRef } from "react";
import { db } from "../../db/database";
import { useAppStore } from "../../app/store";
import styles from "./BackupPanel.module.css";

interface BackupPayload {
  version: 1;
  exportedAt: number;
  groups: unknown[];
  periods: unknown[];
  clientRows: unknown[];
}

export function BackupPanel() {
  const init = useAppStore((s) => s.init);
  const groupsCount = useAppStore((s) => s.groups.length);
  const periodsCount = useAppStore((s) => s.periods.length);
  const rowsCount = useAppStore((s) => s.clientRows.length);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleExport() {
    const [groups, periods, clientRows] = await Promise.all([
      db.groups.toArray(),
      db.periods.toArray(),
      db.clientRows.toArray(),
    ]);
    const payload: BackupPayload = {
      version: 1,
      exportedAt: Date.now(),
      groups,
      periods,
      clientRows,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const dateStr = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `client-totals-backup-${dateStr}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImportClick() {
    fileInputRef.current?.click();
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    const text = await file.text();
    let payload: BackupPayload;
    try {
      payload = JSON.parse(text);
    } catch {
      window.alert("ფაილი არასწორია — JSON ვერ წაიკითხა.");
      return;
    }
    if (!payload.groups || !payload.periods || !payload.clientRows) {
      window.alert("ბექაფის ფორმატი არასწორია.");
      return;
    }
    if (
      !window.confirm(
        "იმპორტი ჩაანაცვლებს ამჟამინდელ ყველა მონაცემს. გავაგრძელოთ?"
      )
    ) {
      return;
    }

    await db.transaction("rw", db.groups, db.periods, db.clientRows, async () => {
      await Promise.all([
        db.groups.clear(),
        db.periods.clear(),
        db.clientRows.clear(),
      ]);
      await db.groups.bulkAdd(payload.groups as never[]);
      await db.periods.bulkAdd(payload.periods as never[]);
      await db.clientRows.bulkAdd(payload.clientRows as never[]);
    });
    await init();
    window.alert("იმპორტი დასრულდა.");
  }

  return (
    <div className={styles.panel}>
      <div className={styles.stats}>
        <span>ჯგუფები: {groupsCount}</span>
        <span>პერიოდები: {periodsCount}</span>
        <span>კლიენტები: {rowsCount}</span>
      </div>
      <div className={styles.actions}>
        <button className={styles.btnPrimary} type="button" onClick={handleExport}>
          💾 Export JSON
        </button>
        <button className={styles.btn} type="button" onClick={handleImportClick}>
          ♻️ Import JSON
        </button>
        <button
          className={styles.btn}
          type="button"
          onClick={() => import("./exportExcel").then((m) => m.exportToExcel())}
        >
          📊 Export Excel
        </button>
        <button
          className={styles.btn}
          type="button"
          onClick={() => import("./exportPdf").then((m) => m.exportToPdf())}
        >
          📄 Export PDF
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          hidden
          onChange={handleImportFile}
        />
      </div>
    </div>
  );
}
