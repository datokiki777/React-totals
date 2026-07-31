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
        <span>🔄 ახალი ვერსია ხელმისაწვდომია.</span>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.primary}
            onClick={() => updateServiceWorker(true)}
          >
            განახლება
          </button>
          <button type="button" className={styles.dismiss} onClick={() => setNeedRefresh(false)}>
            მოგვიანებით
          </button>
        </div>
      </div>
    );
  }

  if (offlineReady) {
    return (
      <div className={styles.banner} role="status">
        <span>✅ აპლიკაცია მზადაა ოფლაინ რეჟიმისთვის.</span>
        <button type="button" className={styles.dismiss} onClick={() => setOfflineReady(false)}>
          გასაგებია
        </button>
      </div>
    );
  }

  return null;
}
