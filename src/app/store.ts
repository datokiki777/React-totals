import { create } from "zustand";
import { db } from "../db/database";
import { generateId, now } from "../shared/lib/id";
import type {
  Group,
  Period,
  ClientRow,
  DoneStatus,
} from "../shared/types/domain";

export type ViewMode = "edit" | "review";
export type WorkspaceTab = "active" | "archive";

interface AppState {
  // data
  groups: Group[];
  periods: Period[];
  clientRows: ClientRow[];
  loaded: boolean;
  initError: string | null;

  // ui state
  activeGroupId: string | null;
  mode: ViewMode;
  workspace: WorkspaceTab;

  // lifecycle
  init: () => Promise<void>;

  // groups
  addGroup: (name: string) => Promise<Group>;
  renameGroup: (id: string, name: string) => void;
  updateGroupSettings: (id: string, patch: { defaultRate?: number; defaultSalary?: number }) => void;
  deleteGroup: (id: string) => void;
  toggleArchiveGroup: (id: string) => void;
  setActiveGroup: (id: string | null) => void;

  // periods
  addPeriod: (groupId: string, opts?: Partial<Period>) => Promise<Period>;
  updatePeriod: (id: string, patch: Partial<Period>) => void;
  removePeriod: (id: string) => void;

  // client rows
  addClientRow: (periodId: string) => Promise<ClientRow>;
  updateClientRow: (id: string, patch: Partial<ClientRow>) => void;
  removeClientRow: (id: string) => void;
  cycleRowStatus: (id: string) => void;

  // ui
  setMode: (mode: ViewMode) => void;
  setWorkspace: (ws: WorkspaceTab) => void;
}

const STATUS_CYCLE: DoneStatus[] = ["none", "done", "fail", "fixed", "wrong"];

function persist(label: string, task: () => Promise<unknown>) {
  // Fire-and-forget persistence: the UI already reflects the change
  // (optimistic update happened synchronously in `set()` before this runs).
  // We still await the write internally so real failures are logged instead
  // of silently disappearing, but we never block/delay the next keystroke.
  task().catch((error) => {
    console.error(`Failed to persist ${label} to IndexedDB:`, error);
  });
}

export const useAppStore = create<AppState>((set, get) => ({
  groups: [],
  periods: [],
  clientRows: [],
  loaded: false,
  initError: null,
  activeGroupId: null,
  mode: "edit",
  workspace: "active",

  init: async () => {
    try {
      const [groups, periods, clientRows] = await Promise.all([
        db.groups.toArray(),
        db.periods.toArray(),
        db.clientRows.toArray(),
      ]);
      const firstActive = groups.find((g) => !g.archived)?.id ?? null;
      set({
        groups,
        periods,
        clientRows,
        activeGroupId: firstActive,
        initError: null,
      });
    } catch (error) {
      console.error("Failed to initialize local database:", error);
      set({
        initError:
          error instanceof Error
            ? error.message
            : "Unknown error while loading local data.",
      });
    } finally {
      set({ loaded: true });
    }
  },

  addGroup: async (name) => {
    const group: Group = {
      id: generateId(),
      name: name.trim() || "New group",
      archived: false,
      defaultRate: 13.5,
      defaultSalary: 0,
      createdAt: now(),
      updatedAt: now(),
    };
    set((s) => ({ groups: [...s.groups, group], activeGroupId: group.id }));
    persist("group", () => db.groups.add(group));
    return group;
  },

  renameGroup: (id, name) => {
    const patch = { name: name.trim(), updatedAt: now() };
    set((s) => ({
      groups: s.groups.map((g) => (g.id === id ? { ...g, ...patch } : g)),
    }));
    persist("group rename", () => db.groups.update(id, patch));
  },

  updateGroupSettings: (id, patch) => {
    const full = { ...patch, updatedAt: now() };
    set((s) => ({
      groups: s.groups.map((g) => (g.id === id ? { ...g, ...full } : g)),
    }));
    persist("group settings", () => db.groups.update(id, full));
  },

  deleteGroup: (id) => {
    const periodIds = get()
      .periods.filter((p) => p.groupId === id)
      .map((p) => p.id);
    set((s) => ({
      groups: s.groups.filter((g) => g.id !== id),
      periods: s.periods.filter((p) => p.groupId !== id),
      clientRows: s.clientRows.filter((r) => !periodIds.includes(r.periodId)),
      activeGroupId: s.activeGroupId === id ? null : s.activeGroupId,
    }));
    persist("group deletion", () =>
      db.transaction("rw", db.groups, db.periods, db.clientRows, async () => {
        await db.clientRows.where("periodId").anyOf(periodIds).delete();
        await db.periods.where("groupId").equals(id).delete();
        await db.groups.delete(id);
      })
    );
  },

  toggleArchiveGroup: (id) => {
    const group = get().groups.find((g) => g.id === id);
    if (!group) return;
    const patch = { archived: !group.archived, updatedAt: now() };
    set((s) => ({
      groups: s.groups.map((g) => (g.id === id ? { ...g, ...patch } : g)),
    }));
    persist("group archive toggle", () => db.groups.update(id, patch));
  },

  setActiveGroup: (id) => set({ activeGroupId: id }),

  addPeriod: async (groupId, opts) => {
    const period: Period = {
      id: generateId(),
      groupId,
      fromDate: opts?.fromDate ?? null,
      toDate: opts?.toDate ?? null,
      paidWeeks: opts?.paidWeeks ?? null,
      createdAt: now(),
      updatedAt: now(),
    };
    set((s) => ({ periods: [...s.periods, period] }));
    persist("period", () => db.periods.add(period));
    return period;
  },

  updatePeriod: (id, patch) => {
    const full = { ...patch, updatedAt: now() };
    set((s) => ({
      periods: s.periods.map((p) => (p.id === id ? { ...p, ...full } : p)),
    }));
    persist("period update", () => db.periods.update(id, full));
  },

  removePeriod: (id) => {
    set((s) => ({
      periods: s.periods.filter((p) => p.id !== id),
      clientRows: s.clientRows.filter((r) => r.periodId !== id),
    }));
    persist("period deletion", () =>
      db.transaction("rw", db.periods, db.clientRows, async () => {
        await db.clientRows.where("periodId").equals(id).delete();
        await db.periods.delete(id);
      })
    );
  },

  addClientRow: async (periodId) => {
    const row: ClientRow = {
      id: generateId(),
      periodId,
      customer: "",
      gross: "",
      net: "",
      city: "",
      status: "none",
      comment: "",
      createdAt: now(),
      updatedAt: now(),
    };
    set((s) => ({ clientRows: [...s.clientRows, row] }));
    persist("client row", () => db.clientRows.add(row));
    return row;
  },

  updateClientRow: (id, patch) => {
    const full = { ...patch, updatedAt: now() };
    set((s) => ({
      clientRows: s.clientRows.map((r) => (r.id === id ? { ...r, ...full } : r)),
    }));
    persist("client row update", () => db.clientRows.update(id, full));
  },

  removeClientRow: (id) => {
    set((s) => ({ clientRows: s.clientRows.filter((r) => r.id !== id) }));
    persist("client row deletion", () => db.clientRows.delete(id));
  },

  cycleRowStatus: (id) => {
    const row = get().clientRows.find((r) => r.id === id);
    if (!row) return;
    const idx = STATUS_CYCLE.indexOf(row.status);
    const nextStatus = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
    get().updateClientRow(id, { status: nextStatus });
  },

  setMode: (mode) => set({ mode }),
  setWorkspace: (workspace) => set({ workspace }),
}));
