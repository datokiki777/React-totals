import type { StateCreator } from "zustand";
import { getGroupById } from "../../../shared/lib/entityLookup";
import type { AppState } from "../types";

export type ViewMode = "edit" | "review" | "settings";
export type WorkspaceTab = "active" | "archive";
export type TotalsScope = "current" | "all";

const LAST_MODE_STORAGE_KEY = "client-totals:last-mode";

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

  setActiveGroup: (id: string | null) => void;
  setMode: (mode: ViewMode) => void;
  setWorkspace: (ws: WorkspaceTab) => void;
  setTotalsScope: (scope: TotalsScope) => void;
  highlightRow: (id: string) => void;
  requestExpandPeriod: (id: string) => void;
  clearExpandPeriodRequest: () => void;
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

  setActiveGroup: (id) =>
    set((s) => {
      const group = getGroupById(s.groups, id);
      if (!group) return { activeGroupId: id };
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
});
