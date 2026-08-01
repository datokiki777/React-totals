import type { CloudSnapshot } from "./cloudSnapshot";

/**
 * Thin abstraction over "read/write the one main cloud document". Kept as
 * an interface (rather than importing Firebase everywhere) so the sync
 * orchestration logic can be tested against an in-memory fake instead of
 * a real Firestore project.
 */
export interface CloudBackend {
  readMainSnapshot(): Promise<CloudSnapshot | null>;
  writeMainSnapshot(snapshot: CloudSnapshot): Promise<void>;
}

/**
 * In-memory fake used by tests (and available for local-only development
 * without touching a real project). Mirrors the real backend's async
 * shape exactly.
 */
export function createInMemoryCloudBackend(initial: CloudSnapshot | null = null): CloudBackend {
  let stored: CloudSnapshot | null = initial;
  return {
    async readMainSnapshot() {
      return stored;
    },
    async writeMainSnapshot(snapshot) {
      stored = snapshot;
    },
  };
}

let firestoreBackendPromise: Promise<CloudBackend> | null = null;

/**
 * Lazily creates the real Firestore-backed CloudBackend. Firebase itself
 * is only imported here (dynamic import), so nothing about the sync
 * engine's logic depends on the SDK being present — useful for tests and
 * for keeping it out of the main bundle until it's actually needed.
 */
export function getFirestoreCloudBackend(): Promise<CloudBackend> {
  if (!firestoreBackendPromise) {
    firestoreBackendPromise = (async () => {
      const { getFirebaseApp } = await import("./config");
      const { getFirestore, doc, getDoc, setDoc } = await import("firebase/firestore");

      const app = getFirebaseApp();
      const firestore = getFirestore(app);
      const mainDocRef = doc(firestore, "backups", "main");

      return {
        async readMainSnapshot() {
          const snap = await getDoc(mainDocRef);
          if (!snap.exists()) return null;
          const data = snap.data();
          return (data?.data ?? null) as CloudSnapshot | null;
        },
        async writeMainSnapshot(snapshot) {
          await setDoc(mainDocRef, {
            data: snapshot,
            updatedAt: new Date().toISOString(),
          });
        },
      } satisfies CloudBackend;
    })();
  }
  return firestoreBackendPromise;
}
