import { create } from "zustand";
import { db } from "../db/database";
import { generateId, now } from "../shared/lib/id";
import { roundMoneyString } from "../shared/lib/money";
import { hashPin, REQUIRED_PIN } from "../shared/lib/pin";
import type {
  Group,
  Period,
  ClientRow,
  DoneStatus,
  AppSettings,
} from "../shared/types/domain";
import type { CloudSnapshot } from "../firebase/cloudSnapshot";

export type ViewMode = "edit" | "review" | "settings";
export type WorkspaceTab = "active" | "archive";
export type TotalsScope = "current" | "all";
export type CloudSyncStatus = "idle" | "syncing" | "synced" | "local" | "error";

const DEFAULT_SETTINGS: AppSettings = {
  id: "app",
  defaultRate: 13.5,
  defaultSalary: 0,
  currencySymbol: "€",
  confirmDestructiveActions: true,
};

interface AppState {
  // data
  groups: Group[];
  periods: Period[];
  clientRows: ClientRow[];
  loaded: boolean;
  initError: string | null;
  /** ISO timestamp of the last local mutation — used by cloud sync to
   * decide which side (local vs cloud) is newer. */
  dataUpdatedAt: string | null;

  // ui state
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
  settings: AppSettings;

  // PIN lock (per-device)
  deviceVerified: boolean;

  // Cloud sync (Firebase)
  cloudStatus: CloudSyncStatus;
  cloudError: string | null;
  cloudUserEmail: string | null;
  cloudConflict: { local: CloudSnapshot; cloud: CloudSnapshot } | null;
  /** Human-readable explanation of what the last sync actually did — e.g.
   * "Uploaded — this device was newer" — so the person never has to
   * wonder which side won. */
  cloudLastSyncDetail: string | null;
  /** ISO timestamp of the last time a sync/save/load actually completed
   * successfully — shown instead of the detail text, once available. */
  cloudLastSyncedAt: string | null;
  /** ISO timestamp of the last successful backup of any kind (cloud save,
   * JSON/Excel/PDF export). */
  lastBackupAt: string | null;

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
  setTotalsScope: (scope: TotalsScope) => void;
  highlightRow: (id: string) => void;
  requestExpandPeriod: (id: string) => void;
  clearExpandPeriodRequest: () => void;
  updateSettings: (patch: Partial<Omit<AppSettings, "id">>) => void;
  clearAllData: () => Promise<void>;

  // PIN lock actions
  verifyPin: (pin: string) => Promise<boolean>;

  // Cloud sync actions (state setters — the actual Firebase orchestration
  // lives in src/firebase/, which calls these; keeps this store
  // Firebase-agnostic)
  setCloudStatus: (status: CloudSyncStatus, error?: string | null) => void;
  setCloudUserEmail: (email: string | null) => void;
  setCloudConflict: (conflict: { local: CloudSnapshot; cloud: CloudSnapshot } | null) => void;
  setCloudSyncDetail: (detail: string | null) => void;
  /** Marks "right now" as the last successful sync time. */
  markCloudSynced: () => void;
  markBackupMade: () => void;
  /** Replaces ALL local data with a pulled cloud snapshot (used for both
   * "new device" pulls and resolved conflicts) — preserves every group
   * (including archived), period, row, and id exactly as they came from
   * the cloud. */
  applyCloudSnapshot: (snapshot: CloudSnapshot) => Promise<void>;
}

const STATUS_CYCLE: DoneStatus[] = ["none", "done", "fail", "fixed", "wrong"];

function persist(label: string, task: () => Promise<unknown>, touchTimestamp = true) {
  if (touchTimestamp) {
    const ts = new Date().toISOString();
    useAppStore.setState({ dataUpdatedAt: ts });
    db.syncMeta
      .get("app")
      .then((meta) => db.syncMeta.put({ id: "app", lastBackupAt: meta?.lastBackupAt, dataUpdatedAt: ts }))
      .catch(() => {});
  }
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
  dataUpdatedAt: null,
  activeGroupId: null,
  lastActiveGroupIdActive: null,
  lastActiveGroupIdArchive: null,
  mode: "edit",
  workspace: "active",
  highlightedRowId: null,
  expandPeriodId: null,
  totalsScope: "current",
  settings: DEFAULT_SETTINGS,
  deviceVerified: false,
  cloudStatus: "idle",
  cloudError: null,
  cloudUserEmail: null,
  cloudConflict: null,
  cloudLastSyncDetail: null,
  cloudLastSyncedAt: null,
  lastBackupAt: null,

  init: async () => {
    try {
      const [groups, periods, rawClientRows, storedSettings, deviceSecurity, syncMeta] =
        await Promise.all([
          db.groups.toArray(),
          db.periods.toArray(),
          db.clientRows.toArray(),
          db.settings.get("app"),
          db.deviceSecurity.get("device"),
          db.syncMeta.get("app"),
        ]);

      // The app no longer supports cents anywhere. Round any legacy
      // gross/net values that still have decimals (e.g. from an older
      // export or a pre-rounding version of this app) and rewrite them,
      // so stored data matches what's displayed everywhere from now on.
      const rowsToFix: ClientRow[] = [];
      const clientRows = rawClientRows.map((row) => {
        const gross = roundMoneyString(row.gross);
        const net = roundMoneyString(row.net);
        if (gross === row.gross && net === row.net) return row;
        const fixed = { ...row, gross, net, updatedAt: now() };
        rowsToFix.push(fixed);
        return fixed;
      });
      if (rowsToFix.length) {
        persist("rounding legacy cents", () => db.clientRows.bulkPut(rowsToFix), false);
      }

      const firstActive = groups.find((g) => !g.archived)?.id ?? null;
      const firstArchived = groups.find((g) => g.archived)?.id ?? null;
      set({
        groups,
        periods,
        clientRows,
        activeGroupId: firstActive,
        lastActiveGroupIdActive: firstActive,
        lastActiveGroupIdArchive: firstArchived,
        settings: storedSettings ? { ...DEFAULT_SETTINGS, ...storedSettings } : DEFAULT_SETTINGS,
        deviceVerified: deviceSecurity?.verified ?? false,
        dataUpdatedAt: syncMeta?.dataUpdatedAt ?? null,
        lastBackupAt: syncMeta?.lastBackupAt ?? null,
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
    const { defaultRate, defaultSalary } = get().settings;
    const group: Group = {
      id: generateId(),
      name: name.trim() || "New group",
      archived: false,
      defaultRate,
      defaultSalary,
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
      lastActiveGroupIdActive: s.lastActiveGroupIdActive === id ? null : s.lastActiveGroupIdActive,
      lastActiveGroupIdArchive:
        s.lastActiveGroupIdArchive === id ? null : s.lastActiveGroupIdArchive,
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
    const nowArchived = !group.archived;
    const patch = { archived: nowArchived, updatedAt: now() };
    set((s) => ({
      groups: s.groups.map((g) => (g.id === id ? { ...g, ...patch } : g)),
      ...(s.activeGroupId === id
        ? nowArchived
          ? { lastActiveGroupIdArchive: id }
          : { lastActiveGroupIdActive: id }
        : {}),
    }));
    persist("group archive toggle", () => db.groups.update(id, patch));
  },

  setActiveGroup: (id) =>
    set((s) => {
      const group = id ? s.groups.find((g) => g.id === id) : undefined;
      if (!group) return { activeGroupId: id };
      return group.archived
        ? { activeGroupId: id, lastActiveGroupIdArchive: id }
        : { activeGroupId: id, lastActiveGroupIdActive: id };
    }),

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

  updateSettings: (patch) => {
    const full = { ...get().settings, ...patch };
    set({ settings: full });
    persist("settings", () => db.settings.put(full));
  },

  clearAllData: async () => {
    await db.transaction("rw", db.groups, db.periods, db.clientRows, async () => {
      await Promise.all([db.groups.clear(), db.periods.clear(), db.clientRows.clear()]);
    });
    set({
      groups: [],
      periods: [],
      clientRows: [],
      activeGroupId: null,
      highlightedRowId: null,
    });
    persist("clear all data", () => Promise.resolve());
  },

  verifyPin: async (pin) => {
    const attemptHash = await hashPin(pin);
    const requiredHash = await hashPin(REQUIRED_PIN);
    if (attemptHash !== requiredHash) return false;
    set({ deviceVerified: true });
    await db.deviceSecurity.put({ id: "device", verified: true });
    return true;
  },

  setCloudStatus: (cloudStatus, error = null) => set({ cloudStatus, cloudError: error }),
  setCloudUserEmail: (cloudUserEmail) => set({ cloudUserEmail }),
  setCloudConflict: (cloudConflict) => set({ cloudConflict }),
  setCloudSyncDetail: (cloudLastSyncDetail) => set({ cloudLastSyncDetail }),
  markCloudSynced: () => set({ cloudLastSyncedAt: new Date().toISOString() }),

  markBackupMade: () => {
    const ts = new Date().toISOString();
    set({ lastBackupAt: ts });
    db.syncMeta
      .get("app")
      .then((meta) => db.syncMeta.put({ id: "app", dataUpdatedAt: meta?.dataUpdatedAt ?? ts, lastBackupAt: ts }))
      .catch(() => {});
  },

  applyCloudSnapshot: async (snapshot) => {
    await db.transaction(
      "rw",
      db.groups,
      db.periods,
      db.clientRows,
      db.settings,
      db.syncMeta,
      async () => {
        await Promise.all([db.groups.clear(), db.periods.clear(), db.clientRows.clear()]);
        if (snapshot.groups.length) await db.groups.bulkAdd(snapshot.groups);
        if (snapshot.periods.length) await db.periods.bulkAdd(snapshot.periods);
        if (snapshot.clientRows.length) await db.clientRows.bulkAdd(snapshot.clientRows);
        await db.settings.put(snapshot.settings);
        await db.syncMeta.put({ id: "app", dataUpdatedAt: snapshot.dataUpdatedAt });
      }
    );

    const firstActive = snapshot.groups.find((g) => !g.archived)?.id ?? null;
    const firstArchived = snapshot.groups.find((g) => g.archived)?.id ?? null;
    set({
      groups: snapshot.groups,
      periods: snapshot.periods,
      clientRows: snapshot.clientRows,
      settings: snapshot.settings,
      dataUpdatedAt: snapshot.dataUpdatedAt,
      activeGroupId: firstActive,
      lastActiveGroupIdActive: firstActive,
      lastActiveGroupIdArchive: firstArchived,
    });
  },
}));
