import { useEffect } from "react";
import { useAppStore } from "./app/store";
import { GroupSwitcher } from "./features/groups/GroupSwitcher";
import { PeriodList } from "./features/periods/PeriodList";
import { OverviewSection } from "./features/overview/OverviewSection";
import { BackupPanel } from "./features/backup/BackupPanel";
import { ReviewSearch } from "./features/review/ReviewSearch";
import { ReviewList } from "./features/review/ReviewList";
import styles from "./App.module.css";

function App() {
  const loaded = useAppStore((s) => s.loaded);
  const initError = useAppStore((s) => s.initError);
  const init = useAppStore((s) => s.init);
  const mode = useAppStore((s) => s.mode);
  const setMode = useAppStore((s) => s.setMode);
  const workspace = useAppStore((s) => s.workspace);
  const setWorkspace = useAppStore((s) => s.setWorkspace);

  useEffect(() => {
    init();
  }, [init]);

  if (!loaded) {
    return <div className={styles.splash}>იტვირთება…</div>;
  }

  if (initError) {
    return (
      <div className={styles.splash}>
        <div className={styles.errorBox}>
          <div className={styles.errorTitle}>⚠️ ლოკალური მონაცემების ჩატვირთვა ვერ მოხერხდა</div>
          <div className={styles.errorText}>{initError}</div>
          <div className={styles.errorHint}>
            სცადე გვერდის განახლება. თუ ეს არ დაეხმარა, IndexedDB შესაძლოა
            ბრაუზერის მიერ დაბლოკილია (მაგ. პრივატული რეჟიმი).
          </div>
          <button className={styles.errorRetry} onClick={() => init()} type="button">
            ხელახლა ცდა
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.app}>
      <header className={styles.topbar}>
        <div className={styles.topRow}>
          <div className={styles.workspaceSwitch}>
            <button
              className={workspace === "active" ? styles.tabActive : styles.tab}
              onClick={() => setWorkspace("active")}
            >
              აქტიური
            </button>
            <button
              className={workspace === "archive" ? styles.tabActive : styles.tab}
              onClick={() => setWorkspace("archive")}
            >
              არქივი
            </button>
          </div>
        </div>
        <div className={styles.topRow}>
          <GroupSwitcher />
        </div>
        <div className={styles.topRow}>
          <div className={styles.modeSwitch}>
            <button
              className={mode === "edit" ? styles.tabActive : styles.tab}
              onClick={() => setMode("edit")}
            >
              რედაქტირება
            </button>
            <button
              className={mode === "review" ? styles.tabActive : styles.tab}
              onClick={() => setMode("review")}
            >
              მიმოხილვა
            </button>
          </div>
        </div>
      </header>

      <main className={styles.main}>
        <OverviewSection />
        <BackupPanel />
        {mode === "edit" ? (
          <PeriodList />
        ) : (
          <>
            <ReviewSearch />
            <ReviewList />
          </>
        )}
      </main>

      <footer className={styles.footer}>
        მონაცემები ინახება ამ მოწყობილობაზე (IndexedDB). Export/Import მალე დაემატება.
      </footer>
    </div>
  );
}

export default App;
