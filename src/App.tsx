import { useEffect } from "react";
import { useAppStore } from "./app/store";
import { GroupSwitcher } from "./features/groups/GroupSwitcher";
import { PeriodList } from "./features/periods/PeriodList";
import { OverviewSection } from "./features/overview/OverviewSection";
import { ReviewSearch } from "./features/review/ReviewSearch";
import { ReviewList } from "./features/review/ReviewList";
import { SettingsPanel } from "./features/settings/SettingsPanel";
import { UpdatePrompt } from "./pwa/UpdatePrompt";
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
    return (
      <div className={styles.splash} role="status" aria-live="polite">
        იტვირთება…
      </div>
    );
  }

  if (initError) {
    return (
      <div className={styles.splash}>
        <div className={styles.errorBox} role="alert">
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
          <button
            className={mode === "settings" ? styles.settingsBtnActive : styles.settingsBtn}
            onClick={() => setMode("settings")}
            role="tab"
            aria-selected={mode === "settings"}
            aria-label="პარამეტრები"
            type="button"
          >
            ⚙️
          </button>
          <div className={styles.workspaceSwitch} role="tablist" aria-label="სამუშაო სივრცე">
            <button
              className={workspace === "active" ? styles.tabActive : styles.tab}
              onClick={() => setWorkspace("active")}
              role="tab"
              aria-selected={workspace === "active"}
            >
              აქტიური
            </button>
            <button
              className={workspace === "archive" ? styles.tabActive : styles.tab}
              onClick={() => setWorkspace("archive")}
              role="tab"
              aria-selected={workspace === "archive"}
            >
              არქივი
            </button>
          </div>
        </div>
        <div className={styles.topRow}>
          <div className={styles.modeSwitchCompact} role="tablist" aria-label="რეჟიმი">
            <button
              className={mode === "edit" ? styles.tabActive : styles.tab}
              onClick={() => setMode("edit")}
              role="tab"
              aria-selected={mode === "edit"}
            >
              რედაქტირება
            </button>
            <button
              className={mode === "review" ? styles.tabActive : styles.tab}
              onClick={() => setMode("review")}
              role="tab"
              aria-selected={mode === "review"}
            >
              მიმოხილვა
            </button>
          </div>
          <div className={styles.groupSwitcherSlot}>
            <GroupSwitcher />
          </div>
        </div>
      </header>

      <main className={styles.main}>
        {mode === "settings" ? (
          <SettingsPanel />
        ) : (
          <>
            <OverviewSection />
            {mode === "edit" ? (
              <PeriodList />
            ) : (
              <>
                <ReviewSearch />
                <ReviewList />
              </>
            )}
          </>
        )}
      </main>

      <footer className={styles.footer}>
        მონაცემები ინახება ამ მოწყობილობაზე (IndexedDB). ბექაფი/აღდგენა — პარამეტრების ჩანართში.
      </footer>

      <UpdatePrompt />
    </div>
  );
}

export default App;
