import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useAppStore } from "./store";
import { resetAppForTest } from "../test/resetAppForTest";
import { db } from "../db/database";
import { buildCloudSnapshot } from "../firebase/cloudSnapshot";
import { REQUIRED_PIN } from "../shared/lib/pin";

describe("store — PIN lock (automatic, fixed PIN — not user-configurable)", () => {
  beforeEach(async () => {
    await resetAppForTest();
    // resetAppForTest() marks the device verified by default (so unrelated
    // tests don't have to deal with the PIN gate) — these tests are
    // specifically about that gate, so simulate a genuinely fresh device.
    await db.deviceSecurity.clear();
    useAppStore.setState({ deviceVerified: false });
  });

  it("verifyPin succeeds for the correct (fixed) PIN and verifies this device", async () => {
    expect(useAppStore.getState().deviceVerified).toBe(false);

    expect(await useAppStore.getState().verifyPin(REQUIRED_PIN)).toBe(true);
    expect(useAppStore.getState().deviceVerified).toBe(true);

    const stored = await db.deviceSecurity.get("device");
    expect(stored?.verified).toBe(true);
  });

  it("verifyPin fails for any wrong PIN and leaves the device unverified", async () => {
    expect(await useAppStore.getState().verifyPin("0000")).toBe(false);
    expect(useAppStore.getState().deviceVerified).toBe(false);
    expect(await db.deviceSecurity.get("device")).toBeUndefined();
  });

  it("a fresh device starts unverified — the PIN gate is on by default, not opt-in", async () => {
    expect(useAppStore.getState().deviceVerified).toBe(false);
  });
});

describe("store — applyCloudSnapshot", () => {
  beforeEach(async () => {
    await resetAppForTest();
  });

  afterEach(async () => {
    await resetAppForTest();
  });

  it("replaces local data with the snapshot, preserving archived groups/periods/rows/ids exactly", async () => {
    const snapshot = buildCloudSnapshot(
      [
        {
          id: "g-active",
          name: "Active Group",
          archived: false,
          defaultRate: 15,
          defaultSalary: 0,
          createdAt: 1,
          updatedAt: 1,
        },
        {
          id: "g-archived",
          name: "Archived Group",
          archived: true,
          defaultRate: 25,
          defaultSalary: 500,
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      [
        {
          id: "p1",
          groupId: "g-archived",
          fromDate: "2026-02-01",
          toDate: "2026-02-14",
          paidWeeks: 2,
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      [
        {
          id: "r1",
          periodId: "p1",
          customer: "Cloud Client",
          gross: "999",
          net: "",
          city: "Kutaisi",
          status: "fixed",
          comment: "from the cloud",
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      {
        id: "app",
        defaultRate: 13.5,
        defaultSalary: 0,
        currencySymbol: "$",
        confirmDestructiveActions: false,
      },
      "2026-08-01T09:00:00.000Z"
    );

    await useAppStore.getState().applyCloudSnapshot(snapshot);

    const state = useAppStore.getState();
    expect(state.groups).toHaveLength(2);
    expect(state.groups.find((g) => g.id === "g-archived")?.archived).toBe(true);
    expect(state.periods).toHaveLength(1);
    expect(state.clientRows).toHaveLength(1);
    expect(state.clientRows[0].comment).toBe("from the cloud");
    expect(state.settings.currencySymbol).toBe("$");
    expect(state.dataUpdatedAt).toBe("2026-08-01T09:00:00.000Z");

    // Persisted to IndexedDB too, not just in-memory state.
    expect(await db.groups.count()).toBe(2);
    expect(await db.clientRows.count()).toBe(1);
    const dbArchived = await db.groups.get("g-archived");
    expect(dbArchived?.archived).toBe(true);
    expect(dbArchived?.defaultSalary).toBe(500);
  });
});
