import { useState } from "react";
import { useAppStore } from "../../app/store";
import { BackupPanel } from "../backup/BackupPanel";
import packageJson from "../../../package.json";
import styles from "./SettingsPanel.module.css";

const CURRENCY_OPTIONS = [
  { symbol: "€", label: "€ Euro" },
  { symbol: "$", label: "$ US Dollar" },
  { symbol: "£", label: "£ British Pound" },
  { symbol: "₾", label: "₾ Georgian Lari" },
  { symbol: "₽", label: "₽ Russian Ruble" },
];

const CLEAR_CONFIRM_PHRASE = "წაშალე";

export function SettingsPanel() {
  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const clearAllData = useAppStore((s) => s.clearAllData);
  const groupsCount = useAppStore((s) => s.groups.length);
  const periodsCount = useAppStore((s) => s.periods.length);
  const rowsCount = useAppStore((s) => s.clientRows.length);

  const [clearConfirmText, setClearConfirmText] = useState("");
  const [clearing, setClearing] = useState(false);
  const [cleared, setCleared] = useState(false);

  const canClear = clearConfirmText.trim() === CLEAR_CONFIRM_PHRASE;

  async function handleClearAllData() {
    if (!canClear) return;
    setClearing(true);
    try {
      await clearAllData();
      setClearConfirmText("");
      setCleared(true);
      setTimeout(() => setCleared(false), 3000);
    } finally {
      setClearing(false);
    }
  }

  return (
    <div className={styles.wrap}>
      <section className={styles.card}>
        <h2 className={styles.cardTitle}>ახალი ჯგუფის ნაგულისხმევი მნიშვნელობები</h2>
        <div className={styles.fieldRow}>
          <label className={styles.field}>
            <span>ნაგულისხმევი საკომისიო %</span>
            <input
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={settings.defaultRate}
              onChange={(e) => updateSettings({ defaultRate: Number(e.target.value) })}
            />
          </label>
          <label className={styles.field}>
            <span>ნაგულისხმევი ხელფასი / 28დღე</span>
            <input
              type="number"
              step="1"
              min="0"
              value={settings.defaultSalary}
              onChange={(e) => updateSettings({ defaultSalary: Number(e.target.value) })}
            />
          </label>
        </div>
        <p className={styles.hint}>
          ეს მნიშვნელობები გამოიყენება მხოლოდ ახალი ჯგუფის შექმნისას — უკვე არსებული ჯგუფების
          პარამეტრები არ იცვლება.
        </p>
      </section>

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>ვალუტის ჩვენება</h2>
        <label className={styles.field}>
          <span>სავალუტო სიმბოლო</span>
          <select
            value={settings.currencySymbol}
            onChange={(e) => updateSettings({ currencySymbol: e.target.value })}
          >
            {CURRENCY_OPTIONS.map((opt) => (
              <option key={opt.symbol} value={opt.symbol}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <p className={styles.hint}>
          ეს მხოლოდ ჩვენების ფორმატს ცვლის — შენახული რიცხვითი მნიშვნელობები უცვლელი რჩება.
        </p>
      </section>

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>დადასტურება</h2>
        <label className={styles.toggleRow}>
          <input
            type="checkbox"
            checked={settings.confirmDestructiveActions}
            onChange={(e) => updateSettings({ confirmDestructiveActions: e.target.checked })}
          />
          <span>დაადასტურე წაშლის მოქმედებები (ჯგუფი, პერიოდი, კლიენტი)</span>
        </label>
      </section>

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>ბექაფი და აღდგენა</h2>
        <BackupPanel />
      </section>

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>აპლიკაციის ინფორმაცია</h2>
        <div className={styles.infoGrid}>
          <span>სახელი</span>
          <span>{packageJson.name}</span>
          <span>ვერსია</span>
          <span>{packageJson.version}</span>
          <span>მონაცემები</span>
          <span>
            {groupsCount} ჯგუფი · {periodsCount} პერიოდი · {rowsCount} კლიენტი
          </span>
        </div>
      </section>

      <section className={`${styles.card} ${styles.dangerCard}`}>
        <h2 className={styles.cardTitle}>ყველა მონაცემის წაშლა</h2>
        <p className={styles.hint}>
          ეს სამუდამოდ წაშლის ყველა ჯგუფს, პერიოდსა და კლიენტს ამ მოწყობილობაზე. ეს ქმედება
          <b> შეუქცევადია</b>. დაწერე ზუსტად <code>{CLEAR_CONFIRM_PHRASE}</code>, რომ ღილაკი
          გააქტიურდეს.
        </p>
        <div className={styles.clearRow}>
          <input
            type="text"
            className={styles.clearInput}
            value={clearConfirmText}
            onChange={(e) => setClearConfirmText(e.target.value)}
            placeholder={CLEAR_CONFIRM_PHRASE}
            aria-label={`დაწერე "${CLEAR_CONFIRM_PHRASE}" წასაშლელად დასადასტურებლად`}
          />
          <button
            type="button"
            className={styles.clearBtn}
            disabled={!canClear || clearing}
            onClick={handleClearAllData}
          >
            {clearing ? "იშლება…" : "წაშალე ყველა მონაცემი"}
          </button>
        </div>
        {cleared && <div className={styles.clearedMessage}>ყველა მონაცემი წაიშალა.</div>}
      </section>
    </div>
  );
}
