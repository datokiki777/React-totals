import { useEffect, useRef } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import styles from "./UpdatePrompt.module.css";

/**
 * Visible "new version available" banner (instead of silently swapping the
 * service worker under the user), plus friendly offline-ready and
 * registration-error messages. Uses vite-plugin-pwa's official React hook.
 */
export function UpdatePrompt() {
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    immediate: true,
    onRegisteredSW(_swUrl, registration) {
      registrationRef.current = registration ?? null;
      void registration?.update();
    },
    onRegisterError(error) {
      console.error("Service worker registration failed:", error);
    },
  });

  useEffect(() => {
    const checkForUpdate = () => {
      if (document.visibilityState === "visible" && navigator.onLine) {
        void registrationRef.current?.update();
      }
    };

    document.addEventListener("visibilitychange", checkForUpdate);
    window.addEventListener("online", checkForUpdate);
    const intervalId = window.setInterval(checkForUpdate, 15 * 60 * 1000);

    return () => {
      document.removeEventListener("visibilitychange", checkForUpdate);
      window.removeEventListener("online", checkForUpdate);
      window.clearInterval(intervalId);
    };
  }, []);

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
