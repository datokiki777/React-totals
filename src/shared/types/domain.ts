// Domain types — core data model, shared across features.

export type DoneStatus = "none" | "done" | "fail" | "fixed" | "wrong";

export interface Group {
  id: string;
  name: string;
  archived: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Period {
  id: string;
  groupId: string;
  fromDate: string | null; // ISO date (YYYY-MM-DD)
  toDate: string | null;
  paidWeeks: number | null;
  defaultRate: number; // %
  defaultSalary: number; // per 28d
  archived: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface ClientRow {
  id: string;
  periodId: string;
  customer: string;
  gross: number;
  net: number;
  city: string;
  status: DoneStatus;
  comment: string;
  createdAt: number;
  updatedAt: number;
}

export interface PeriodTotals {
  gross: number;
  net: number;
  myEur: number;
}

export interface AppSettings {
  id: "app"; // singleton row
  defaultRate: number;
  defaultSalary: number;
}
