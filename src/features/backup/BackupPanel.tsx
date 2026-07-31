import { useRef, useState } from "react";
import { db } from "../../db/database";
import { useAppStore } from "../../app/store";
import { buildBackupPayload } from "../../shared/lib/backup";
import { parseAnyBackupFormat } from "../../shared/lib/legacyMigration";
import styles from "./BackupPanel.module.css";

type Message = { type: "success" | "error"; text: string } | null;

export function BackupPanel() {
  const init = useAppStore((s) => s.init);
  const groupsCount = useAppStore((s) => s.groups.length);
  const periodsCount = useAppStore((s) => s.periods.length);
  const rowsCount = useAppStore((s) => s.clientRows.length);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<Message>(null);
  const [busy, setBusy] = useState(false);

  async function handleExportJson() {
    const [groups, periods, clientRows] = await Promise.all([
      db.groups.toArray(),
      db.periods.toArray(),
      db.clientRows.toArray(),
    ]);
    const payload = buildBackupPayload(groups, periods, clientRows);

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

    setMessage({ type: "success", text: "JSON ბექაფი წარმატებით შეიქმნა." });
  }

  function handleImportClick() {
    setMessage(null);
    fileInputRef.current?.click();
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setMessage(null);

    let parsed: unknown;
    try {
      const text = await file.text();
      parsed = JSON.parse(text);
    } catch {
      setMessage({ type: "error", text: "ფაილი არასწორია — JSON ვერ წაიკითხა." });
      return;
    }

    const result = parseAnyBackupFormat(parsed);
    if (!result.ok) {
      setMessage({ type: "error", text: `ბექაფის ფორმატი არასწორია: ${result.error}` });
      return;
    }

    const { groups, periods, clientRows } = result.data;
    const migratedFromLegacy = result.migratedFromLegacy;

    if (
      !window.confirm(
        (migratedFromLegacy
          ? `ეს ძველი (Vanilla JS) აპლიკაციის ფაილია — ავტომატურად გადაკონვერტირდება ახალ ფორმატში.\n\n`
          : "") +
          `იმპორტი ჩაანაცვლებს ამჟამინდელ ყველა მონაცემს ფაილით "${file.name}" ` +
          `(${groups.length} ჯგუფი, ${periods.length} პერიოდი, ${clientRows.length} კლიენტი).\n\n` +
          "ეს ქმედება შეუქცევადია. გავაგრძელოთ?"
      )
    ) {
      return;
    }

    setBusy(true);
    try {
      await db.transaction("rw", db.groups, db.periods, db.clientRows, async () => {
        await Promise.all([db.groups.clear(), db.periods.clear(), db.clientRows.clear()]);
        if (groups.length) await db.groups.bulkAdd(groups);
        if (periods.length) await db.periods.bulkAdd(periods);
        if (clientRows.length) await db.clientRows.bulkAdd(clientRows);
      });

      // Refresh all Zustand state from IndexedDB — no page reload needed.
      await init();

      setMessage({
        type: "success",
        text: migratedFromLegacy
          ? "ძველი ვერსიის ფაილი წარმატებით გადაკონვერტირდა და აიტვირთა."
          : "იმპორტი წარმატებით დასრულდა.",
      });
    } catch (error) {
      console.error("Import failed:", error);
      setMessage({
        type: "error",
        text: "იმპორტი ვერ შესრულდა — მონაცემთა ბაზაში ჩაწერა ვერ მოხერხდა.",
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleExportExcel() {
    setBusy(true);
    try {
      const { exportToExcel } = await import("./exportExcel");
      await exportToExcel();
      setMessage({ type: "success", text: "Excel ფაილი წარმატებით შეიქმნა." });
    } catch (error) {
      console.error("Excel export failed:", error);
      setMessage({ type: "error", text: "Excel ექსპორტი ვერ შესრულდა." });
    } finally {
      setBusy(false);
    }
  }

  async function handleExportPdf() {
    setBusy(true);
    try {
      const { exportToPdf } = await import("./exportPdf");
      await exportToPdf();
      setMessage({ type: "success", text: "PDF ფაილი წარმატებით შეიქმნა." });
    } catch (error) {
      console.error("PDF export failed:", error);
      setMessage({ type: "error", text: "PDF ექსპორტი ვერ შესრულდა." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.panel}>
      <div className={styles.stats}>
        <span>ჯგუფები: {groupsCount}</span>
        <span>პერიოდები: {periodsCount}</span>
        <span>კლიენტები: {rowsCount}</span>
      </div>

      {message && (
        <div
          role="status"
          className={message.type === "error" ? styles.messageError : styles.messageSuccess}
        >
          {message.text}
        </div>
      )}

      <div className={styles.actions}>
        <button className={styles.btnPrimary} type="button" onClick={handleExportJson} disabled={busy}>
          💾 Export JSON
        </button>
        <button className={styles.btn} type="button" onClick={handleImportClick} disabled={busy}>
          ♻️ Import JSON
        </button>
        <button className={styles.btn} type="button" onClick={handleExportExcel} disabled={busy}>
          📊 Export Excel
        </button>
        <button className={styles.btn} type="button" onClick={handleExportPdf} disabled={busy}>
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
