import type { Group, Period, ClientRow } from "../types/domain";

/**
 * Small, pure entity-lookup helpers — no state, no side effects. Extracted
 * because the same filters/finds (periods for a group, rows for a period,
 * a group/period by id) were duplicated across calc.ts, excelExport.ts,
 * exportPdf.ts, search.ts, several store slices, and a few components.
 * Pure refactor: every call site's behavior is unchanged, this just gives
 * the repeated logic one name and one place to read instead of several
 * copies of the same `.filter()`/`.find()`.
 */

export function getPeriodsForGroup(periods: Period[], groupId: string): Period[] {
  return periods.filter((p) => p.groupId === groupId);
}

export function getRowsForPeriod(clientRows: ClientRow[], periodId: string): ClientRow[] {
  return clientRows.filter((r) => r.periodId === periodId);
}

export function getGroupById(groups: Group[], id: string | null | undefined): Group | undefined {
  if (!id) return undefined;
  return groups.find((g) => g.id === id);
}

export function getPeriodById(periods: Period[], id: string | null | undefined): Period | undefined {
  if (!id) return undefined;
  return periods.find((p) => p.id === id);
}
