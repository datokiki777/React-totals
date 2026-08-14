import type { StateCreator } from "zustand";
import { clientRowRepository } from "../../../db/repositories/clientRowRepository";
import { generateId, now } from "../../../shared/lib/id";
import type { ClientRow, DoneStatus } from "../../../shared/types/domain";
import { createPersistHelper } from "../persistHelper";
import type { AppState } from "../types";

const STATUS_CYCLE: DoneStatus[] = ["none", "done", "fail", "fixed", "wrong"];

export interface ClientRowsSlice {
  clientRows: ClientRow[];

  addClientRow: (periodId: string) => Promise<ClientRow>;
  updateClientRow: (id: string, patch: Partial<ClientRow>) => void;
  removeClientRow: (id: string) => void;
  cycleRowStatus: (id: string) => void;
}

export const createClientRowsSlice: StateCreator<AppState, [], [], ClientRowsSlice> = (set, get) => {
  const persist = createPersistHelper(set);

  return {
    clientRows: [],

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
        visitDate: null,
        visitDays: null,
        createdAt: now(),
        updatedAt: now(),
      };
      set((s) => ({ clientRows: [...s.clientRows, row] }));
      persist("client row", () => clientRowRepository.add(row));
      return row;
    },

    updateClientRow: (id, patch) => {
      const full = { ...patch, updatedAt: now() };
      set((s) => ({
        clientRows: s.clientRows.map((r) => (r.id === id ? { ...r, ...full } : r)),
      }));
      persist("client row update", () => clientRowRepository.update(id, full));
    },

    removeClientRow: (id) => {
      set((s) => ({ clientRows: s.clientRows.filter((r) => r.id !== id) }));
      persist("client row deletion", () => clientRowRepository.delete(id));
    },

    cycleRowStatus: (id) => {
      const row = get().clientRows.find((r) => r.id === id);
      if (!row) return;
      const idx = STATUS_CYCLE.indexOf(row.status);
      const nextStatus = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
      get().updateClientRow(id, { status: nextStatus });
    },
  };
};
