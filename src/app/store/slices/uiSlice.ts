import type { StateCreator } from "zustand";
import { getGroupById } from "../../../shared/lib/entityLookup";
import type { AppState } from "../types";

export type ViewMode = "edit" | "review" | "settings";
export type WorkspaceTab = "active" | "archive";
export type TotalsScope = "current" | "all";

const LAST_MODE_STORAGE_KEY = "client-totals:last-mode";
const LAST_ACTIVE_GROUP_STORAGE_KEY = "client-totals:last-active-group";
const LAST_ARCHIVE_GROUP_STORAGE_KEY = "client-totals:last-archive-group";
const AMOUNTS_HIDDEN_STORAGE_KEY = "client-totals:amounts-hidden";

export function getRememberedGroupId(archived: boolean): string | null {
  try {
    return localStorage.getItem(
      archived ? LAST_ARCHIVE_GROUP_STORAGE_KEY : LAST_ACTIVE_GROUP_STORAGE_KEY
    );
  } catch {
    return null;
  }
}

function rememberGroupId(id: string, archived: boolean) {
  try {
    localStorage.setItem(
      archived ? LAST_ARCHIVE_GROUP_STORAGE_KEY : LAST_ACTIVE_GROUP_STORAGE_KEY,
      id
    );
  } catch {
    // Ignore storage failures.
  }
}

function getInitialMode(): ViewMode {
  try {
    const stored = localStorage.getItem(LAST_MODE_STORAGE_KEY);
    if (stored === "edit" || stored === "review") return stored;
  } catch {
    // Storage can fail (private browsing, quota, etc.) — fall through to
    // the default below.
  }
  return "edit";
}

function getInitialAmountsHidden(): boolean {
  try {
    const stored = localStorage.getItem(AMOUNTS_HIDDEN_STORAGE_KEY);
    // Defaults to hidden (privacy-first) unless the person has
    // explicitly turned it off before — "0" is the only way to get false.
    if (stored === "0") return false;
    return true;
  } catch {
    return true;
  }
}

export interface UiSlice {
  activeGroupId: string | null;
  /** Remembers which group was last selected on each workspace tab, so
   * switching Active <-> Archive restores the right group instead of
   * leaving a stale/invisible one selected. */
  lastActiveGroupIdActive: string | null;
  lastActiveGroupIdArchive: string | null;
  mode: ViewMode;
  workspace: WorkspaceTab;
  highlightedRowId: string | null;
  /** Set by Review/Search when it navigates to a row, so the target
   * period force-opens even though periods now start collapsed. */
  expandPeriodId: string | null;
  totalsScope: TotalsScope;
  /** Blurs every money amount in the app when true — a privacy toggle
   * for when someone's phone might be glanced at. Per-device (not
   * synced), defaults to true (hidden) on first use. */
  amountsHidden: boolean;

  setActiveGroup: (id: string | null) => void;
  setMode: (mode: ViewMode) => void;
  setWorkspace: (ws: WorkspaceTab) => void;
  setTotalsScope: (scope: TotalsScope) => void;
  highlightRow: (id: string) => void;
  requestExpandPeriod: (id: string) => void;
  clearExpandPeriodRequest: () => void;
  toggleAmountsHidden: () => void;
}

export const createUiSlice: StateCreator<AppState, [], [], UiSlice> = (set, get) => ({
  activeGroupId: null,
  lastActiveGroupIdActive: null,
  lastActiveGroupIdArchive: null,
  mode: getInitialMode(),
  workspace: "active",
  highlightedRowId: null,
  expandPeriodId: null,
  totalsScope: "current",
  amountsHidden: getInitialAmountsHidden(),

  setActiveGroup: (id) =>
    set((s) => {
      const group = getGroupById(s.groups, id);
      if (!group) return { activeGroupId: id };
      if (id) rememberGroupId(id, group.archived);
      return group.archived
        ? { activeGroupId: id, lastActiveGroupIdArchive: id }
        : { activeGroupId: id, lastActiveGroupIdActive: id };
    }),

  setMode: (mode) => {
    set({ mode });
    // Remembered per-device (not synced) — only edit/review are real
    // content tabs; settings is a temporary overlay, not something to
    // reopen into next time.
    if (mode === "edit" || mode === "review") {
      try {
        localStorage.setItem(LAST_MODE_STORAGE_KEY, mode);
      } catch {
        // Storage can fail (private browsing, quota, etc.) — not worth
        // surfacing to the person, the app just won't remember this time.
      }
    }
  },

  setWorkspace: (workspace) =>
    set((s) => {
      const remembered =
        workspace === "archive" ? s.lastActiveGroupIdArchive : s.lastActiveGroupIdActive;
      const candidates = s.groups.filter((g) =>
        workspace === "archive" ? g.archived : !g.archived
      );
      const rememberedIsValid = remembered && candidates.some((g) => g.id === remembered);
      const nextActiveGroupId = rememberedIsValid ? remembered : (candidates[0]?.id ?? null);
      return { workspace, activeGroupId: nextActiveGroupId };
    }),

  setTotalsScope: (totalsScope) => set({ totalsScope }),

  highlightRow: (id) => {
    set({ highlightedRowId: id });
    setTimeout(() => {
      // Only clear if nothing else re-triggered a highlight in the meantime.
      if (get().highlightedRowId === id) set({ highlightedRowId: null });
    }, 1800);
  },

  requestExpandPeriod: (id) => set({ expandPeriodId: id }),
  clearExpandPeriodRequest: () => set({ expandPeriodId: null }),

  toggleAmountsHidden: () =>
    set((s) => {
      const next = !s.amountsHidden;
      try {
        localStorage.setItem(AMOUNTS_HIDDEN_STORAGE_KEY, next ? "1" : "0");
      } catch {
        // Storage can fail (private browsing, quota, etc.) — the toggle
        // still works for this session, it just won't be remembered.
      }
      return { amountsHidden: next };
    }),
});
