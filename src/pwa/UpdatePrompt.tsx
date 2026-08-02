import { useRegisterSW } from "virtual:pwa-register/react";
import styles from "./UpdatePrompt.module.css";

/**
 * Visible "new version available" banner (instead of silently swapping the
 * service worker under the user), plus friendly offline-ready and
 * registration-error messages. Uses vite-plugin-pwa's official React hook.
 */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError(error) {
      console.error("Service worker registration failed:", error);
    },
  });

  if (needRefresh) {
    return (
      <div className={styles.banner} role="status">
        <span>🔄 A new version is available.</span>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.primary}
            onClick={() => updateServiceWorker(true)}
          >
            Update
          </button>
          <button type="button" className={styles.dismiss} onClick={() => setNeedRefresh(false)}>
            Later
          </button>
        </div>
      </div>
    );
  }

  if (offlineReady) {
    return (
      <div className={styles.banner} role="status">
        <span>✅ App is ready for offline use.</span>
        <button type="button" className={styles.dismiss} onClick={() => setOfflineReady(false)}>
          Got it
        </button>
      </div>
    );
  }

  return null;
}
