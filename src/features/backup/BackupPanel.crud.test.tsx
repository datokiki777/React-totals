import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../../App";
import { db } from "../../db/database";
import { resetAppForTest } from "../../test/resetAppForTest";
import { buildBackupPayload } from "../../shared/lib/backup";
import {
  legacyWrappedBackup,
  legacyUnwrappedBackup,
} from "../../shared/lib/__fixtures__/legacyBackupSample";

function makeFile(content: string, name = "backup.json", type = "application/json"): File {
  return new File([content], name, { type });
}

async function openSettings(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("tab", { name: /პარამეტრები/ }));
  await screen.findByRole("heading", { name: "ბექაფი და აღდგენა" });
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
    await openSettings(user);

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(fileInput, makeFile("{ not valid json", "broken.json"));

    expect(await screen.findByRole("status")).toHaveTextContent(/JSON ვერ წაიკითხა/);
  });

  it("shows a clear inline error for structurally invalid backup data", async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText("აირჩიე ჯგუფი ▾");
    await openSettings(user);

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
    await openSettings(user);

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
    await openSettings(user);

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
    await openSettings(user);

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

  it("imports a real old vanilla-JS app backup file (wrapped format) without ever saying 'invalid backup'", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(true);

    render(<App />);
    await screen.findByText("აირჩიე ჯგუფი ▾");
    await openSettings(user);

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(fileInput, makeFile(JSON.stringify(legacyWrappedBackup), "Totals_ALL_2025-03-01.json"));

    await waitFor(() => {
      expect(screen.getByText("ჯგუფები: 2")).toBeInTheDocument();
    });
    expect(screen.getByText("პერიოდები: 3")).toBeInTheDocument();
    expect(screen.getByText("კლიენტები: 7")).toBeInTheDocument();

    const status = await screen.findByRole("status");
    expect(status).toHaveTextContent(/გადაკონვერტირდა/);
    expect(status).not.toHaveTextContent(/არასწორია/);

    // Spot-check real data actually landed correctly, decimals intact.
    const rows = await db.clientRows.toArray();
    const acme = rows.find((r) => r.customer === "Acme Corp")!;
    expect(acme.gross).toBe("1234.56");
    expect(acme.status).toBe("done");

    const groups = await db.groups.toArray();
    const archived = groups.find((g) => g.name === "Archived Group B")!;
    expect(archived.archived).toBe(true);
    expect(archived.defaultSalary).toBe(150); // legacy defaultSalaryAmount alias

    // Confirm the Active/Archive workspace tabs actually reflect the import
    // (not just IndexedDB): open the group picker on each tab and check
    // which group names are listed there. (The picker button always shows
    // the currently *active* group's name, "Client Group A", regardless of
    // which workspace tab is selected — only its dropdown *contents* are
    // workspace-filtered.)
    await user.click(screen.getByRole("tab", { name: "რედაქტირება" }));
    const pickerBtn = screen.getByRole("button", { name: /Client Group A/ });

    await user.click(pickerBtn); // open, on the Active tab
    expect(screen.getByRole("button", { name: "Client Group A" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Archived Group B" })).not.toBeInTheDocument();
    await user.click(pickerBtn); // close

    await user.click(screen.getByRole("tab", { name: "არქივი" }));
    await user.click(pickerBtn); // open, on the Archive tab
    expect(await screen.findByRole("button", { name: "Archived Group B" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Client Group A" })).not.toBeInTheDocument();
  });

  it("imports the old app's raw/unwrapped appState format too", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(true);

    render(<App />);
    await screen.findByText("აირჩიე ჯგუფი ▾");
    await openSettings(user);

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(fileInput, makeFile(JSON.stringify(legacyUnwrappedBackup)));

    await waitFor(() => {
      expect(screen.getByText("ჯგუფები: 2")).toBeInTheDocument();
    });
    expect(await screen.findByRole("status")).toHaveTextContent(/გადაკონვერტირდა/);
  });

  it("new-format exports are unaffected by the legacy-migration path (no false-positive migration)", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(true);

    render(<App />);
    await screen.findByText("აირჩიე ჯგუფი ▾");
    await openSettings(user);

    const payload = buildBackupPayload(
      [{ id: "g1", name: "Native Group", archived: false, defaultRate: 10, defaultSalary: 0, createdAt: 0, updatedAt: 0 }],
      [],
      []
    );
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(fileInput, makeFile(JSON.stringify(payload)));

    const status = await screen.findByRole("status");
    expect(status).toHaveTextContent("იმპორტი წარმატებით დასრულდა.");
    expect(status).not.toHaveTextContent(/გადაკონვერტირდა/);
  });
});
