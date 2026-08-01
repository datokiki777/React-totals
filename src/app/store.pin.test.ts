import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useAppStore } from "./store";
import { resetAppForTest } from "../test/resetAppForTest";
import { db } from "../db/database";
import { buildCloudSnapshot } from "../firebase/cloudSnapshot";

describe("store — PIN lock", () => {
  beforeEach(async () => {
    await resetAppForTest();
  });

  it("setPinLock(enabled) hashes and stores the PIN, and verifies this device immediately", async () => {
    await useAppStore.getState().setPinLock({ enabled: true, newPin: "135790" });

    const state = useAppStore.getState();
    expect(state.settings.pinEnabled).toBe(true);
    expect(state.settings.pinHash).toMatch(/^[0-9a-f]{64}$/);
    expect(state.settings.pinHash).not.toContain("135790");
    expect(state.deviceVerified).toBe(true);

    const stored = await db.deviceSecurity.get("device");
    expect(stored?.verified).toBe(true);
  });

  it("verifyPin succeeds for the correct PIN and fails for a wrong one", async () => {
    await useAppStore.getState().setPinLock({ enabled: true, newPin: "246810" });
    // Simulate a fresh, unverified device (e.g. a second browser).
    useAppStore.setState({ deviceVerified: false });
    await db.deviceSecurity.delete("device");

    expect(await useAppStore.getState().verifyPin("000000")).toBe(false);
    expect(useAppStore.getState().deviceVerified).toBe(false);

    expect(await useAppStore.getState().verifyPin("246810")).toBe(true);
    expect(useAppStore.getState().deviceVerified).toBe(true);
    expect((await db.deviceSecurity.get("device"))?.verified).toBe(true);
  });

  it("verifyPin returns false if no PIN has ever been set", async () => {
    expect(await useAppStore.getState().verifyPin("123456")).toBe(false);
  });

  it("setPinLock(disabled) clears the hash and the per-device verified flag", async () => {
    await useAppStore.getState().setPinLock({ enabled: true, newPin: "112233" });
    await useAppStore.getState().setPinLock({ enabled: false });

    const state = useAppStore.getState();
    expect(state.settings.pinEnabled).toBe(false);
    expect(state.settings.pinHash).toBeNull();
    expect(state.deviceVerified).toBe(false);
    expect(await db.deviceSecurity.get("device")).toBeUndefined();
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
        pinEnabled: false,
        pinHash: null,
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
