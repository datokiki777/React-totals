import { describe, it, expect } from "vitest";
import { computePeriodTotals } from "./calc";
import type { ClientRow, Period } from "../types/domain";

function makePeriod(rate: number): Period {
  return {
    id: "p1",
    groupId: "g1",
    fromDate: "2026-01-01",
    toDate: "2026-01-31",
    paidWeeks: null,
    defaultRate: rate,
    defaultSalary: 0,
    archived: false,
    createdAt: 0,
    updatedAt: 0,
  };
}

function makeRow(overrides: Partial<ClientRow>): ClientRow {
  return {
    id: Math.random().toString(36),
    periodId: "p1",
    customer: "Test",
    gross: "",
    net: "",
    city: "",
    status: "none",
    comment: "",
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  };
}

describe("computePeriodTotals — must match the old vanilla app exactly", () => {
  it("uses Net as the My€ base when Net is entered", () => {
    const period = makePeriod(10); // 10%
    const rows = [makeRow({ gross: "1000", net: "800" })];
    const totals = computePeriodTotals(period, rows);
    expect(totals.gross).toBe(1000);
    expect(totals.net).toBe(800);
    // base = net (800) since hasNet, not gross
    expect(totals.myEur).toBeCloseTo(80);
  });

  it("falls back to Gross as the My€ base when Net is not entered", () => {
    const period = makePeriod(10);
    const rows = [makeRow({ gross: "500", net: "" })];
    const totals = computePeriodTotals(period, rows);
    expect(totals.myEur).toBeCloseTo(50); // base = gross (500)
  });

  it("treats an explicit Net of '0' as entered — does NOT fall back to Gross", () => {
    const period = makePeriod(10);
    const rows = [makeRow({ gross: "500", net: "0" })];
    const totals = computePeriodTotals(period, rows);
    expect(totals.myEur).toBe(0); // base = net (0), gross ignored for My€
    expect(totals.gross).toBe(500); // gross sum still includes it
  });

  it("excludes rows marked 'wrong' from every total", () => {
    const period = makePeriod(10);
    const rows = [
      makeRow({ gross: "1000", net: "800", status: "wrong" }),
      makeRow({ gross: "100", net: "80", status: "none" }),
    ];
    const totals = computePeriodTotals(period, rows);
    expect(totals.gross).toBe(100);
    expect(totals.net).toBe(80);
    expect(totals.myEur).toBeCloseTo(8);
  });

  it("skips rows with neither Gross nor Net entered", () => {
    const period = makePeriod(10);
    const rows = [makeRow({ gross: "", net: "" })];
    const totals = computePeriodTotals(period, rows);
    expect(totals.gross).toBe(0);
    expect(totals.net).toBe(0);
    expect(totals.myEur).toBe(0);
  });

  it("sums multiple rows correctly", () => {
    const period = makePeriod(20);
    const rows = [
      makeRow({ gross: "100", net: "" }), // base 100
      makeRow({ gross: "", net: "50" }), // base 50
      makeRow({ gross: "999", net: "999", status: "wrong" }), // excluded
    ];
    const totals = computePeriodTotals(period, rows);
    expect(totals.gross).toBe(100);
    expect(totals.net).toBe(50);
    expect(totals.myEur).toBeCloseTo((100 + 50) * 0.2);
  });

  it("clamps an out-of-range rate before applying it", () => {
    const period = makePeriod(500); // invalid, should clamp to 100
    const rows = [makeRow({ gross: "10", net: "" })];
    const totals = computePeriodTotals(period, rows);
    expect(totals.myEur).toBe(10); // 100% of 10
  });

  it("parses European-formatted money strings", () => {
    const period = makePeriod(10);
    const rows = [makeRow({ gross: "1.234,56", net: "" })];
    const totals = computePeriodTotals(period, rows);
    expect(totals.gross).toBeCloseTo(1234.56);
    expect(totals.myEur).toBeCloseTo(123.456);
  });

  it("ignores rows belonging to a different period", () => {
    const period = makePeriod(10);
    const rows = [
      makeRow({ gross: "100", periodId: "other-period" }),
      makeRow({ gross: "50", periodId: "p1" }),
    ];
    const totals = computePeriodTotals(period, rows);
    expect(totals.gross).toBe(50);
  });
});
