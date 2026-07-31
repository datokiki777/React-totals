import { db } from "../db/database";
import { useAppStore } from "../app/store";

/**
 * Resets both IndexedDB and the in-memory Zustand store between e2e tests.
 *
 * Store mutations are optimistic/fire-and-forget (state updates
 * synchronously, the IndexedDB write happens in the background) — so a
 * write still in flight from the previous test could otherwise land in
 * IndexedDB *after* we've cleared it here. The short delay lets any such
 * writes finish before we reset, so no state leaks across tests.
 */
export async function resetAppForTest(): Promise<void> {
  await db.groups.clear();
  await db.periods.clear();
  await db.clientRows.clear();
  await new Promise((r) => setTimeout(r, 30));

  useAppStore.setState({
    groups: [],
    periods: [],
    clientRows: [],
    activeGroupId: null,
    mode: "edit",
    workspace: "active",
    totalsScope: "current",
    highlightedRowId: null,
    loaded: false,
    initError: null,
  });
}
