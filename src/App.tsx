import { useEffect, useRef } from "react";
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

  // Remembers which mode (Edit/Review) was active before Settings was
  // opened, so a second tap on the Settings button closes it back to
  // wherever the person actually was, instead of always landing on Edit.
  const lastNonSettingsMode = useRef<"edit" | "review">("edit");
  if (mode !== "settings") {
    lastNonSettingsMode.current = mode;
  }

  function toggleSettings() {
    setMode(mode === "settings" ? lastNonSettingsMode.current : "settings");
  }

  useEffect(() => {
    init();
  }, [init]);

  if (!loaded) {
    return (
      <div className={styles.splash} role="status" aria-live="polite">
        Loading…
      </div>
    );
  }

  if (initError) {
    return (
      <div className={styles.splash}>
        <div className={styles.errorBox} role="alert">
          <div className={styles.errorTitle}>⚠️ Failed to load local data</div>
          <div className={styles.errorText}>{initError}</div>
          <div className={styles.errorHint}>
            Try refreshing the page. If that doesn't help, IndexedDB might be
            blocked by your browser (e.g. private mode).
          </div>
          <button className={styles.errorRetry} onClick={() => init()} type="button">
            Retry
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
            onClick={toggleSettings}
            role="tab"
            aria-selected={mode === "settings"}
            aria-label="Settings"
            type="button"
          >
            ⚙️
          </button>
          <div className={styles.workspaceSwitch} role="tablist" aria-label="Workspace">
            <button
              className={workspace === "active" ? styles.tabActive : styles.tab}
              onClick={() => setWorkspace("active")}
              role="tab"
              aria-selected={workspace === "active"}
            >
              Active
            </button>
            <button
              className={workspace === "archive" ? styles.tabActive : styles.tab}
              onClick={() => setWorkspace("archive")}
              role="tab"
              aria-selected={workspace === "archive"}
            >
              Archive
            </button>
          </div>
        </div>
        <div className={styles.topRow}>
          <div className={styles.modeSwitchCompact} role="tablist" aria-label="Mode">
            <button
              className={mode === "edit" ? styles.tabActive : styles.tab}
              onClick={() => setMode("edit")}
              role="tab"
              aria-selected={mode === "edit"}
            >
              Edit
            </button>
            <button
              className={mode === "review" ? styles.tabActive : styles.tab}
              onClick={() => setMode("review")}
              role="tab"
              aria-selected={mode === "review"}
            >
              Review
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
        Data is stored on this device (IndexedDB). Backup/restore is under the Settings tab.
      </footer>

      <UpdatePrompt />
    </div>
  );
}

export default App;
