import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../../App";
import { db } from "../../db/database";
import { resetAppForTest } from "../../test/resetAppForTest";
import { buildBackupPayload } from "../../shared/lib/backup";

function makeFile(content: string, name = "backup.json", type = "application/json"): File {
  return new File([content], name, { type });
}

describe("Import/Export — JSON backup validation, confirmation, and state refresh", () => {
  beforeEach(async () => {
    await resetAppForTest();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("shows a clear inline error for a file that isn't valid JSON at all", async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText("აირჩიე ჯგუფი ▾");

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(fileInput, makeFile("{ not valid json", "broken.json"));

    expect(await screen.findByRole("status")).toHaveTextContent(/JSON ვერ წაიკითხა/);
  });

  it("shows a clear inline error for structurally invalid backup data", async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText("აირჩიე ჯგუფი ▾");

    const badPayload = JSON.stringify({ groups: [{ id: "g1" }], periods: [], clientRows: [] });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(fileInput, makeFile(badPayload));

    const status = await screen.findByRole("status");
    expect(status).toHaveTextContent(/ბექაფის ფორმატი არასწორია/);
  });

  it("rejects an otherwise-valid backup where a row points at a period that isn't in the file", async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText("აირჩიე ჯგუფი ▾");

    const payload = buildBackupPayload(
      [{ id: "g1", name: "G", archived: false, defaultRate: 10, defaultSalary: 0, createdAt: 0, updatedAt: 0 }],
      [],
      [
        {
          id: "r1",
          periodId: "missing-period",
          customer: "X",
          gross: "",
          net: "",
          city: "",
          status: "none",
          comment: "",
          createdAt: 0,
          updatedAt: 0,
        },
      ]
    );

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(fileInput, makeFile(JSON.stringify(payload)));

    expect(await screen.findByRole("status")).toHaveTextContent(/does not exist/);
  });

  it("asks for confirmation before replacing data, and does nothing if declined", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(false);

    render(<App />);
    await screen.findByText("აირჩიე ჯგუფი ▾");

    const payload = buildBackupPayload(
      [{ id: "g1", name: "Imported Group", archived: false, defaultRate: 10, defaultSalary: 0, createdAt: 0, updatedAt: 0 }],
      [],
      []
    );
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(fileInput, makeFile(JSON.stringify(payload)));

    expect(window.confirm).toHaveBeenCalled();
    // Declined -> nothing changes.
    await new Promise((r) => setTimeout(r, 50));
    expect(await db.groups.count()).toBe(0);
    expect(screen.getByText("ჯგუფები: 0")).toBeInTheDocument();
  });

  it("replaces all data and refreshes every Zustand-driven view with no page reload, when confirmed", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const reloadSpy = vi.fn();
    vi.stubGlobal("location", { ...window.location, reload: reloadSpy });

    render(<App />);
    await screen.findByText("აირჩიე ჯგუფი ▾");

    const payload = buildBackupPayload(
      [{ id: "g1", name: "Imported Group", archived: false, defaultRate: 20, defaultSalary: 0, createdAt: 0, updatedAt: 0 }],
      [{ id: "p1", groupId: "g1", fromDate: "2026-01-01", toDate: "2026-01-31", paidWeeks: null, createdAt: 0, updatedAt: 0 }],
      [
        {
          id: "r1",
          periodId: "p1",
          customer: "Restored Client",
          gross: "1000",
          net: "",
          city: "Batumi",
          status: "none",
          comment: "",
          createdAt: 0,
          updatedAt: 0,
        },
      ]
    );

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(fileInput, makeFile(JSON.stringify(payload)));

    await waitFor(() => {
      expect(screen.getByText("ჯგუფები: 1")).toBeInTheDocument();
    });
    expect(screen.getByText("პერიოდები: 1")).toBeInTheDocument();
    expect(screen.getByText("კლიენტები: 1")).toBeInTheDocument();

    // The imported group should now actually be selectable/visible in the UI
    // (proof the Zustand store, not just IndexedDB, was refreshed).
    expect(await screen.findByRole("button", { name: /Imported Group/ })).toBeInTheDocument();

    const dbGroups = await db.groups.toArray();
    expect(dbGroups).toHaveLength(1);
    expect(dbGroups[0].name).toBe("Imported Group");

    expect(reloadSpy).not.toHaveBeenCalled();
  });

  it("preserves decimal values exactly through export/import shape (no rounding)", async () => {
    const payload = buildBackupPayload(
      [{ id: "g1", name: "G", archived: false, defaultRate: 13.5, defaultSalary: 0, createdAt: 0, updatedAt: 0 }],
      [{ id: "p1", groupId: "g1", fromDate: null, toDate: null, paidWeeks: null, createdAt: 0, updatedAt: 0 }],
      [
        {
          id: "r1",
          periodId: "p1",
          customer: "X",
          gross: "1234.56",
          net: "78.9",
          city: "",
          status: "none",
          comment: "",
          createdAt: 0,
          updatedAt: 0,
        },
      ]
    );

    const roundTripped = JSON.parse(JSON.stringify(payload));
    expect(roundTripped.clientRows[0].gross).toBe("1234.56");
    expect(roundTripped.clientRows[0].net).toBe("78.9");
    expect(roundTripped.groups[0].defaultRate).toBe(13.5);
  });
});
