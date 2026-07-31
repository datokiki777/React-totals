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

  // ui state
  activeGroupId: string | null;
  mode: ViewMode;
  workspace: WorkspaceTab;

  // lifecycle
  init: () => Promise<void>;

  // groups
  addGroup: (name: string) => Promise<Group>;
  renameGroup: (id: string, name: string) => Promise<void>;
  deleteGroup: (id: string) => Promise<void>;
  toggleArchiveGroup: (id: string) => Promise<void>;
  setActiveGroup: (id: string | null) => void;

  // periods
  addPeriod: (groupId: string, opts?: Partial<Period>) => Promise<Period>;
  updatePeriod: (id: string, patch: Partial<Period>) => Promise<void>;
  removePeriod: (id: string) => Promise<void>;

  // client rows
  addClientRow: (periodId: string) => Promise<ClientRow>;
  updateClientRow: (id: string, patch: Partial<ClientRow>) => Promise<void>;
  removeClientRow: (id: string) => Promise<void>;
  cycleRowStatus: (id: string) => Promise<void>;

  // ui
  setMode: (mode: ViewMode) => void;
  setWorkspace: (ws: WorkspaceTab) => void;
}

const STATUS_CYCLE: DoneStatus[] = ["none", "done", "fail", "fixed", "wrong"];

export const useAppStore = create<AppState>((set, get) => ({
  groups: [],
  periods: [],
  clientRows: [],
  loaded: false,
  activeGroupId: null,
  mode: "edit",
  workspace: "active",

  init: async () => {
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
      loaded: true,
      activeGroupId: firstActive,
    });
  },

  addGroup: async (name) => {
    const group: Group = {
      id: generateId(),
      name: name.trim() || "New group",
      archived: false,
      createdAt: now(),
      updatedAt: now(),
    };
    await db.groups.add(group);
    set((s) => ({ groups: [...s.groups, group], activeGroupId: group.id }));
    return group;
  },

  renameGroup: async (id, name) => {
    const patch = { name: name.trim(), updatedAt: now() };
    await db.groups.update(id, patch);
    set((s) => ({
      groups: s.groups.map((g) => (g.id === id ? { ...g, ...patch } : g)),
    }));
  },

  deleteGroup: async (id) => {
    const periodIds = get()
      .periods.filter((p) => p.groupId === id)
      .map((p) => p.id);
    await db.transaction("rw", db.groups, db.periods, db.clientRows, async () => {
      await db.clientRows.where("periodId").anyOf(periodIds).delete();
      await db.periods.where("groupId").equals(id).delete();
      await db.groups.delete(id);
    });
    set((s) => ({
      groups: s.groups.filter((g) => g.id !== id),
      periods: s.periods.filter((p) => p.groupId !== id),
      clientRows: s.clientRows.filter((r) => !periodIds.includes(r.periodId)),
      activeGroupId: s.activeGroupId === id ? null : s.activeGroupId,
    }));
  },

  toggleArchiveGroup: async (id) => {
    const group = get().groups.find((g) => g.id === id);
    if (!group) return;
    const patch = { archived: !group.archived, updatedAt: now() };
    await db.groups.update(id, patch);
    set((s) => ({
      groups: s.groups.map((g) => (g.id === id ? { ...g, ...patch } : g)),
    }));
  },

  setActiveGroup: (id) => set({ activeGroupId: id }),

  addPeriod: async (groupId, opts) => {
    const period: Period = {
      id: generateId(),
      groupId,
      fromDate: opts?.fromDate ?? null,
      toDate: opts?.toDate ?? null,
      paidWeeks: opts?.paidWeeks ?? null,
      defaultRate: opts?.defaultRate ?? 13.5,
      defaultSalary: opts?.defaultSalary ?? 0,
      archived: false,
      createdAt: now(),
      updatedAt: now(),
    };
    await db.periods.add(period);
    set((s) => ({ periods: [...s.periods, period] }));
    return period;
  },

  updatePeriod: async (id, patch) => {
    const full = { ...patch, updatedAt: now() };
    await db.periods.update(id, full);
    set((s) => ({
      periods: s.periods.map((p) => (p.id === id ? { ...p, ...full } : p)),
    }));
  },

  removePeriod: async (id) => {
    await db.transaction("rw", db.periods, db.clientRows, async () => {
      await db.clientRows.where("periodId").equals(id).delete();
      await db.periods.delete(id);
    });
    set((s) => ({
      periods: s.periods.filter((p) => p.id !== id),
      clientRows: s.clientRows.filter((r) => r.periodId !== id),
    }));
  },

  addClientRow: async (periodId) => {
    const row: ClientRow = {
      id: generateId(),
      periodId,
      customer: "",
      gross: 0,
      net: 0,
      city: "",
      status: "none",
      comment: "",
      createdAt: now(),
      updatedAt: now(),
    };
    await db.clientRows.add(row);
    set((s) => ({ clientRows: [...s.clientRows, row] }));
    return row;
  },

  updateClientRow: async (id, patch) => {
    const full = { ...patch, updatedAt: now() };
    await db.clientRows.update(id, full);
    set((s) => ({
      clientRows: s.clientRows.map((r) => (r.id === id ? { ...r, ...full } : r)),
    }));
  },

  removeClientRow: async (id) => {
    await db.clientRows.delete(id);
    set((s) => ({ clientRows: s.clientRows.filter((r) => r.id !== id) }));
  },

  cycleRowStatus: async (id) => {
    const row = get().clientRows.find((r) => r.id === id);
    if (!row) return;
    const idx = STATUS_CYCLE.indexOf(row.status);
    const nextStatus = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
    await get().updateClientRow(id, { status: nextStatus });
  },

  setMode: (mode) => set({ mode }),
  setWorkspace: (workspace) => set({ workspace }),
}));
