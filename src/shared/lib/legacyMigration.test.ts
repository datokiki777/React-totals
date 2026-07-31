import { describe, it, expect } from "vitest";
import {
  isLegacyBackup,
  migrateLegacyAppState,
  parseAnyBackupFormat,
} from "./legacyMigration";
import { buildBackupPayload } from "./backup";
import {
  legacyWrappedBackup,
  legacyUnwrappedBackup,
} from "./__fixtures__/legacyBackupSample";

describe("isLegacyBackup — detects both old-app export shapes", () => {
  it("detects the wrapped { __type, data } shape", () => {
    expect(isLegacyBackup(legacyWrappedBackup)).toBe(legacyWrappedBackup.data);
  });

  it("detects the raw/unwrapped appState shape", () => {
    expect(isLegacyBackup(legacyUnwrappedBackup)).toBe(legacyUnwrappedBackup);
  });

  it("does not misidentify the current app's own backup format", () => {
    const current = buildBackupPayload([], [], []);
    expect(isLegacyBackup(current)).toBeNull();
  });

  it("returns null for garbage input", () => {
    expect(isLegacyBackup(null)).toBeNull();
    expect(isLegacyBackup("a string")).toBeNull();
    expect(isLegacyBackup({ foo: "bar" })).toBeNull();
    expect(isLegacyBackup([1, 2, 3])).toBeNull();
  });
});

describe("migrateLegacyAppState — 100% data fidelity from the real old-app shape", () => {
  const result = migrateLegacyAppState(legacyWrappedBackup.data);

  it("migrates every group, preserving id/name/archived and rate/salary", () => {
    expect(result.groups).toHaveLength(2);

    const groupA = result.groups.find((g) => g.id === "grp-1")!;
    expect(groupA.name).toBe("Client Group A");
    expect(groupA.archived).toBe(false);
    expect(groupA.defaultRate).toBe(13.5);
    expect(groupA.defaultSalary).toBe(400);

    const groupB = result.groups.find((g) => g.id === "grp-2")!;
    expect(groupB.name).toBe("Archived Group B");
    expect(groupB.archived).toBe(true);
    expect(groupB.defaultRate).toBe(20);
    // Legacy alias field "defaultSalaryAmount" must still be picked up.
    expect(groupB.defaultSalary).toBe(150);
  });

  it("migrates every period, preserving id/dates/paidWeeks and group linkage", () => {
    expect(result.periods).toHaveLength(3);

    const per1 = result.periods.find((p) => p.id === "per-1")!;
    expect(per1.groupId).toBe("grp-1");
    expect(per1.fromDate).toBe("2025-01-01");
    expect(per1.toDate).toBe("2025-01-31");
    expect(per1.paidWeeks).toBe(3);

    const per2 = result.periods.find((p) => p.id === "per-2")!;
    expect(per2.toDate).toBeNull(); // empty string "to" -> null
    expect(per2.paidWeeks).toBeNull(); // empty string paidWeeks -> null

    const per3 = result.periods.find((p) => p.id === "per-3")!;
    expect(per3.groupId).toBe("grp-2");
  });

  it("migrates every client row with exact ids, values, statuses, and comments", () => {
    expect(result.clientRows).toHaveLength(7);

    const row1 = result.clientRows.find((r) => r.id === "row-1")!;
    expect(row1.periodId).toBe("per-1");
    expect(row1.customer).toBe("Acme Corp");
    expect(row1.city).toBe("Tbilisi");
    expect(row1.gross).toBe("1234.56");
    expect(row1.net).toBe("987.65");
    expect(row1.comment).toBe("Wants a follow-up call next month");
    expect(row1.status).toBe("done");

    const row3 = result.clientRows.find((r) => r.id === "row-3")!;
    expect(row3.status).toBe("wrong");

    const row4 = result.clientRows.find((r) => r.id === "row-4")!;
    expect(row4.status).toBe("fixed");
    expect(row4.city).toBe("");

    const row5 = result.clientRows.find((r) => r.id === "row-5")!;
    expect(row5.status).toBe("none");

    // European decimal-format money string is preserved verbatim (not parsed
    // or reformatted at migration time) — parsing happens later, at calc time.
    const row6 = result.clientRows.find((r) => r.id === "row-6")!;
    expect(row6.gross).toBe("1.234,56");
    expect(row6.comment).toBe("European decimal format");

    const row7 = result.clientRows.find((r) => r.id === "row-7")!;
    expect(row7.periodId).toBe("per-3");
    expect(row7.net).toBe("600");
  });

  it("never rounds or reformats gross/net — decimals preserved exactly", () => {
    const row1 = result.clientRows.find((r) => r.id === "row-1")!;
    expect(row1.gross).toBe("1234.56"); // NOT rounded to "1235" like the old app's own import does
    const row4 = result.clientRows.find((r) => r.id === "row-4")!;
    expect(row4.gross).toBe("250.25");
  });

  it("is lenient about missing fields, mirroring the old app's own normalizeGroupData", () => {
    const sparse = { groups: [{ id: "g1" }] };
    const result2 = migrateLegacyAppState(sparse);
    expect(result2.groups).toHaveLength(1);
    expect(result2.groups[0].name).toBe("Group");
    expect(result2.groups[0].defaultRate).toBe(13.5);
    expect(result2.groups[0].defaultSalary).toBe(0);
    expect(result2.periods).toHaveLength(0);
  });

  it("generates ids for groups/periods/rows that are missing them", () => {
    const noIds = {
      groups: [
        {
          name: "No Ids",
          data: { periods: [{ from: "2025-01-01", rows: [{ customer: "X" }] }] },
        },
      ],
    };
    const result2 = migrateLegacyAppState(noIds);
    expect(result2.groups[0].id).toBeTruthy();
    expect(result2.periods[0].id).toBeTruthy();
    expect(result2.periods[0].groupId).toBe(result2.groups[0].id);
    expect(result2.clientRows[0].id).toBeTruthy();
    expect(result2.clientRows[0].periodId).toBe(result2.periods[0].id);
  });
});

describe("parseAnyBackupFormat — single entry point, auto-detects & migrates", () => {
  it("accepts the wrapped legacy format and migrates it, never reporting 'invalid backup'", () => {
    const result = parseAnyBackupFormat(legacyWrappedBackup);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.migratedFromLegacy).toBe(true);
      expect(result.data.groups).toHaveLength(2);
      expect(result.data.clientRows).toHaveLength(7);
    }
  });

  it("accepts the unwrapped/raw legacy appState format too", () => {
    const result = parseAnyBackupFormat(legacyUnwrappedBackup);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.migratedFromLegacy).toBe(true);
      expect(result.data.groups).toHaveLength(2);
    }
  });

  it("accepts the current app's own backup format without migrating", () => {
    const current = buildBackupPayload(
      [
        {
          id: "g1",
          name: "G",
          archived: false,
          defaultRate: 10,
          defaultSalary: 0,
          createdAt: 0,
          updatedAt: 0,
        },
      ],
      [],
      []
    );
    const result = parseAnyBackupFormat(current);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.migratedFromLegacy).toBe(false);
      expect(result.data.groups).toHaveLength(1);
    }
  });

  it("still rejects genuinely invalid/unrelated JSON with a clear error", () => {
    const result = parseAnyBackupFormat({ hello: "world" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeTruthy();
    }
  });

  it("produces a payload that itself validates successfully end-to-end", () => {
    const migrated = parseAnyBackupFormat(legacyWrappedBackup);
    expect(migrated.ok).toBe(true);
    if (migrated.ok) {
      // Round-trip through JSON like a real file read would.
      const roundTripped = JSON.parse(JSON.stringify(migrated.data));
      const reparsed = parseAnyBackupFormat(roundTripped);
      expect(reparsed.ok).toBe(true);
    }
  });
});
