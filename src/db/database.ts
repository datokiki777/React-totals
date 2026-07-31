import Dexie, { type Table } from "dexie";
import type { Group, Period, ClientRow, AppSettings } from "../shared/types/domain";

// Single source of truth for local persistence.
// Kept intentionally thin: Dexie tables map 1:1 to domain types.
// Any migration in the future = bump version() and add an upgrade().
class ClientTotalsDB extends Dexie {
  groups!: Table<Group, string>;
  periods!: Table<Period, string>;
  clientRows!: Table<ClientRow, string>;
  settings!: Table<AppSettings, string>;

  constructor() {
    super("client-totals-db");

    this.version(1).stores({
      groups: "id, archived, createdAt",
      periods: "id, groupId, archived, fromDate, createdAt",
      clientRows: "id, periodId, status, createdAt",
      settings: "id",
    });
  }
}

export const db = new ClientTotalsDB();
