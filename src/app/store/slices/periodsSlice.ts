import type { StateCreator } from "zustand";
import { periodRepository } from "../../../db/repositories/periodRepository";
import { generateId, now } from "../../../shared/lib/id";
import type { Period } from "../../../shared/types/domain";
import { createPersistHelper } from "../persistHelper";
import type { AppState } from "../types";

export interface PeriodsSlice {
  periods: Period[];

  addPeriod: (groupId: string, opts?: Partial<Period>) => Promise<Period>;
  updatePeriod: (id: string, patch: Partial<Period>) => void;
  removePeriod: (id: string) => void;
}

export const createPeriodsSlice: StateCreator<AppState, [], [], PeriodsSlice> = (set) => {
  const persist = createPersistHelper(set);

  return {
    periods: [],

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
      persist("period", () => periodRepository.add(period));
      return period;
    },

    updatePeriod: (id, patch) => {
      const full = { ...patch, updatedAt: now() };
      set((s) => ({
        periods: s.periods.map((p) => (p.id === id ? { ...p, ...full } : p)),
      }));
      persist("period update", () => periodRepository.update(id, full));
    },

    removePeriod: (id) => {
      set((s) => ({
        periods: s.periods.filter((p) => p.id !== id),
        clientRows: s.clientRows.filter((r) => r.periodId !== id),
      }));
      persist("period deletion", () => periodRepository.deleteCascade(id));
    },
  };
};
