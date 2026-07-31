/**
 * Defensive cleanup for this origin (react-totals.dbuilder.eu).
 *
 * This subdomain is dedicated to the new React app only. If any previous
 * service worker or cache ever got registered here (old test deploys,
 * stale precache versions, etc.), this makes sure only our current
 * sw.js stays in control and nothing else keeps intercepting requests.
 *
 * Safe by construction: it only removes registrations whose active worker
 * is NOT our own /sw.js, and caches that are not our current workbox
 * precache. It never touches other origins/domains.
 */
export async function cleanupLegacyServiceWorkers(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    for (const registration of registrations) {
      const activeUrl = registration.active?.scriptURL ?? "";
      const isOurs = activeUrl.endsWith("/sw.js");
      if (!isOurs) {
        await registration.unregister();
      }
    }
  } catch {
    // ignore — non-critical cleanup
  }

  try {
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => !key.startsWith("workbox-precache"))
          .map((key) => caches.delete(key))
      );
    }
  } catch {
    // ignore — non-critical cleanup
  }
}
