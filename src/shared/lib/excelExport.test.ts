import { describe, it, expect } from "vitest";
import { buildExcelRows, buildExcelSummary } from "./excelExport";
import type { ClientRow, Group, Period } from "../types/domain";

function makeGroup(overrides: Partial<Group> = {}): Group {
  return {
    id: "g1",
    name: "Group 1",
    archived: false,
    defaultRate: 10,
    defaultSalary: 0,
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  };
}

function makePeriod(overrides: Partial<Period> = {}): Period {
  return {
    id: "p1",
    groupId: "g1",
    fromDate: "2026-01-01",
    toDate: "2026-01-31",
    paidWeeks: null,
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  };
}

function makeRow(overrides: Partial<ClientRow> = {}): ClientRow {
  return {
    id: "r1",
    periodId: "p1",
    customer: "Acme",
    gross: "1234.56",
    net: "",
    city: "Tbilisi",
    status: "none",
    comment: "call back",
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  };
}

describe("buildExcelRows", () => {
  it("produces one row per client with the exact field set", () => {
    const rows = buildExcelRows([makeGroup()], [makePeriod()], [makeRow()]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      Group: "Group 1",
      Archived: "no",
      DefaultRatePercent: 10,
      DefaultSalaryPer28Days: 0,
      From: "01/01/2026",
      To: "31/01/2026",
      PaidWeeks: 0,
      Client: "Acme",
      City: "Tbilisi",
      Comment: "call back",
      Status: "none",
    });
  });

  it("preserves decimal precision exactly (no rounding)", () => {
    const rows = buildExcelRows([makeGroup()], [makePeriod()], [makeRow({ gross: "1234.56" })]);
    expect(rows[0].Gross).toBe(1234.56);
  });

  it("marks an archived group's name with the archive icon", () => {
    const rows = buildExcelRows(
      [makeGroup({ archived: true })],
      [makePeriod()],
      [makeRow()]
    );
    expect(rows[0].Group).toBe("📦 Group 1");
    expect(rows[0].Archived).toBe("yes");
  });

  it("includes rows from every period across every group", () => {
    const g2 = makeGroup({ id: "g2", name: "Group 2" });
    const p2 = makePeriod({ id: "p2", groupId: "g2" });
    const rows = buildExcelRows(
      [makeGroup(), g2],
      [makePeriod(), p2],
      [makeRow({ id: "r1", periodId: "p1" }), makeRow({ id: "r2", periodId: "p2" })]
    );
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.Group)).toEqual(["Group 1", "Group 2"]);
  });
});

describe("buildExcelSummary", () => {
  it("aggregates totals and status counts per group", () => {
    const rows = [
      makeRow({ id: "r1", gross: "1000", status: "done" }),
      makeRow({ id: "r2", gross: "500", status: "fail" }),
    ];
    const summary = buildExcelSummary([makeGroup()], [makePeriod()], rows);
    expect(summary).toHaveLength(1);
    expect(summary[0].Gross).toBe(1500);
    expect(summary[0].Done).toBe(1);
    expect(summary[0].Fail).toBe(1);
    expect(summary[0].Periods).toBe(1);
    expect(summary[0].Rows).toBe(2);
  });

  it("computes salary/income the same way as computeGroupFinancials", () => {
    const group = makeGroup({ defaultSalary: 400 }); // 100/week
    const period = makePeriod({ fromDate: "2026-01-01", toDate: "2026-01-07", paidWeeks: 0 });
    const rows = [makeRow({ gross: "1000" })];
    const summary = buildExcelSummary([group], [period], rows);
    expect(summary[0].SalaryAccrued).toBeCloseTo(100);
    expect(summary[0].Income).toBeCloseTo(summary[0].Unpaid - summary[0].SalaryRemaining);
  });

  it("returns one summary row per group even with zero periods", () => {
    const summary = buildExcelSummary([makeGroup()], [], []);
    expect(summary).toHaveLength(1);
    expect(summary[0].Periods).toBe(0);
    expect(summary[0].Gross).toBe(0);
  });
});
