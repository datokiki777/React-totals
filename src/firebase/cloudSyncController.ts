import { useAppStore } from "../app/store";
import { buildCloudSnapshot } from "./cloudSnapshot";
import { getFirestoreCloudBackend, type CloudBackend } from "./cloudBackend";
import { determineAndPerformCloudSync, applyCloudSyncChoice } from "./cloudSyncEngine";
import { subscribeToAuthState } from "./auth";

const AUTO_SYNC_DEBOUNCE_MS = 8000;

let started = false;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let backendPromise: Promise<CloudBackend> | null = null;

async function buildLocalSnapshotFromStore() {
  const s = useAppStore.getState();
  return buildCloudSnapshot(
    s.groups,
    s.periods,
    s.clientRows,
    s.settings,
    s.dataUpdatedAt ?? new Date().toISOString()
  );
}

async function runSyncNow(): Promise<void> {
  try {
    const backend = await (backendPromise ?? (backendPromise = getFirestoreCloudBackend()));
    const s = useAppStore.getState();
    s.setCloudStatus("syncing");

    const outcome = await determineAndPerformCloudSync(backend, {
      hasData: s.groups.length > 0,
      updatedAt: s.dataUpdatedAt,
      snapshot: await buildLocalSnapshotFromStore(),
    });

    if (outcome.decision === "noop") {
      useAppStore.getState().setCloudStatus("idle");
      return;
    }
    if (outcome.decision === "push") {
      useAppStore.getState().setCloudStatus("synced");
      return;
    }
    if (outcome.decision === "pull") {
      await useAppStore.getState().applyCloudSnapshot(outcome.snapshot);
      useAppStore.getState().setCloudStatus("synced");
      return;
    }
    // "ask" — never guess; surface it for the person to resolve explicitly.
    useAppStore.getState().setCloudConflict({
      local: outcome.localSnapshot,
      cloud: outcome.cloudSnapshot,
    });
    useAppStore.getState().setCloudStatus("local");
  } catch (error) {
    console.error("Cloud sync failed:", error);
    useAppStore
      .getState()
      .setCloudStatus("error", error instanceof Error ? error.message : "Cloud sync failed");
  }
}

function scheduleAutoSync() {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    if (navigator.onLine) runSyncNow();
  }, AUTO_SYNC_DEBOUNCE_MS);
}

/**
 * Wires the cloud sync system into the running app: watches auth state,
 * runs a one-time startup sync once signed in, and auto-syncs (debounced)
 * whenever local data changes afterward. Safe to call multiple times —
 * only sets up its subscriptions once per app session.
 */
export function startCloudSync(): void {
  if (started) return;
  started = true;

  subscribeToAuthState(async (user) => {
    useAppStore.getState().setCloudUserEmail(user?.email ?? null);
    if (user) {
      await runSyncNow();
    }
  }).catch((error) => {
    // Firebase unavailable (offline install, blocked script, etc.) — the
    // app stays fully usable in local-only mode, matching the old app.
    console.warn("Cloud sync unavailable, continuing in local-only mode.", error);
  });

  let lastSeenTimestamp = useAppStore.getState().dataUpdatedAt;
  useAppStore.subscribe((state) => {
    if (state.dataUpdatedAt !== lastSeenTimestamp) {
      lastSeenTimestamp = state.dataUpdatedAt;
      if (state.cloudUserEmail) scheduleAutoSync();
    }
  });

  window.addEventListener("online", () => {
    if (useAppStore.getState().cloudUserEmail) runSyncNow();
  });
}

export async function manualCloudSave(): Promise<void> {
  const backend = await (backendPromise ?? (backendPromise = getFirestoreCloudBackend()));
  const snapshot = await buildLocalSnapshotFromStore();
  useAppStore.getState().setCloudStatus("syncing");
  try {
    await backend.writeMainSnapshot(snapshot);
    useAppStore.getState().setCloudStatus("synced");
  } catch (error) {
    useAppStore
      .getState()
      .setCloudStatus("error", error instanceof Error ? error.message : "Save failed");
    throw error;
  }
}

export async function manualCloudLoad(): Promise<void> {
  const backend = await (backendPromise ?? (backendPromise = getFirestoreCloudBackend()));
  useAppStore.getState().setCloudStatus("syncing");
  try {
    const cloudSnapshot = await backend.readMainSnapshot();
    if (!cloudSnapshot) {
      useAppStore.getState().setCloudStatus("idle");
      throw new Error("No cloud backup found yet.");
    }
    await useAppStore.getState().applyCloudSnapshot(cloudSnapshot);
    useAppStore.getState().setCloudStatus("synced");
  } catch (error) {
    useAppStore
      .getState()
      .setCloudStatus("error", error instanceof Error ? error.message : "Load failed");
    throw error;
  }
}

export async function resolveCloudConflict(choice: "keep-local" | "use-cloud"): Promise<void> {
  const conflict = useAppStore.getState().cloudConflict;
  if (!conflict) return;
  const backend = await (backendPromise ?? (backendPromise = getFirestoreCloudBackend()));

  const outcome = await applyCloudSyncChoice(backend, choice, conflict.local);
  if (outcome.decision === "pull") {
    await useAppStore.getState().applyCloudSnapshot(outcome.snapshot);
  }
  useAppStore.getState().setCloudConflict(null);
  useAppStore.getState().setCloudStatus("synced");
}
