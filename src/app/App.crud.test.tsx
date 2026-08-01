import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within, cleanup, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../App";
import { db } from "../db/database";
import { resetAppForTest, openGroupMenu, expandFirstPeriod, mockModalPrompt, mockModalConfirm } from "../test/resetAppForTest";

describe("Client table CRUD (end-to-end against real IndexedDB)", () => {
  beforeEach(async () => {
    await resetAppForTest();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("adds a group, a period, and a client row; edits persist to IndexedDB; My€ is correct", async () => {
    const user = userEvent.setup();
    mockModalPrompt("Test Group");

    render(<App />);

    // Wait for initial load to finish.
    expect(await screen.findByText("Select group ▾")).toBeInTheDocument();

    // 1. Create a group (long-press the group switcher to open its menu first).
    await openGroupMenu();
    await user.click(screen.getByRole("button", { name: "+ Group" }));
    expect(await screen.findByRole("button", { name: /Test Group/ })).toBeInTheDocument();

    // 2. Create a period.
    await user.click(screen.getByRole("button", { name: "+ New period" }));
    await expandFirstPeriod(user);
    expect(await screen.findByText("+ Add client")).toBeInTheDocument();

    // 3. Add a client row.
    await user.click(screen.getByRole("button", { name: "+ Add client" }));

    const table = screen.getByRole("table");
    const customerInput = within(table).getByPlaceholderText("Client name");
    const grossInputs = within(table).getAllByPlaceholderText("0");
    const [grossInput, netInput] = grossInputs;
    const cityInput = within(table).getByPlaceholderText("City");

    await user.type(customerInput, "Acme Corp");
    await user.type(grossInput, "1000");
    await user.type(cityInput, "Tbilisi");

    // No Net entered yet -> My€ should be based on Gross (default rate 13.5%).
    await screen.findByDisplayValue("1000");

    // 4. Verify it actually persisted to IndexedDB (not just in-memory state).
    const rowsAfterGross = await db.clientRows.toArray();
    expect(rowsAfterGross).toHaveLength(1);
    expect(rowsAfterGross[0].customer).toBe("Acme Corp");
    expect(rowsAfterGross[0].gross).toBe("1000");
    expect(rowsAfterGross[0].city).toBe("Tbilisi");

    const periodsAfter = await db.periods.toArray();
    expect(periodsAfter).toHaveLength(1);

    const groupsAfter = await db.groups.toArray();
    expect(groupsAfter[0].defaultRate).toBe(13.5); // rate now lives on the group

    // Expected My€ = gross (1000) * 13.5% = 135, since Net is not entered.
    await screen.findByTestId("period-total-my-eur");
    expect(screen.getByTestId("period-total-my-eur")).toHaveTextContent("135");

    // 5. Now enter an explicit Net of "0" — My€ must become 0 (base = Net, not Gross),
    // exactly matching the old app's semantics for an explicitly-entered zero.
    await user.type(netInput, "0");
    await waitFor(() =>
      expect(screen.getByTestId("period-total-my-eur")).toHaveTextContent("0")
    );

    const rowsAfterNetZero = await db.clientRows.toArray();
    expect(rowsAfterNetZero[0].net).toBe("0");

    // 6. Delete the row (confirm dialog must be accepted).
    mockModalConfirm(true);
    await user.click(within(table).getByRole("button", { name: "Remove" }));

    const rowsAfterDelete = await db.clientRows.toArray();
    expect(rowsAfterDelete).toHaveLength(0);
  });

  it("excludes rows marked 'wrong' from My€ but keeps them visible in the table", async () => {
    const user = userEvent.setup();
    mockModalPrompt("Group W");

    render(<App />);

    await screen.findByText("Select group ▾");
    await openGroupMenu();
    await user.click(screen.getByRole("button", { name: "+ Group" }));
    await user.click(screen.getByRole("button", { name: "+ New period" }));
    await expandFirstPeriod(user);
    await user.click(screen.getByRole("button", { name: "+ Add client" }));

    const table = screen.getByRole("table");
    const grossInput = within(table).getAllByPlaceholderText("0")[0];
    await user.type(grossInput, "500");

    await waitFor(() =>
      expect(screen.getByTestId("period-total-my-eur")).toHaveTextContent("68")
    ); // 500 * 13.5% = 67.5, rounded up to 68

    // Cycle status: none -> done -> fail -> fixed -> wrong
    const statusBtn = within(table).getByRole("button", { name: "—" });
    await user.click(statusBtn); // done
    await user.click(screen.getByRole("button", { name: "✓ Done" })); // fail
    await user.click(screen.getByRole("button", { name: "✕ Fail" })); // fixed
    await user.click(screen.getByRole("button", { name: "⟳ Fixed" })); // wrong

    expect(await screen.findByRole("button", { name: "! Wrong" })).toBeInTheDocument();

    // Row is still visible with its data, but excluded from totals -> 0.00
    await waitFor(() =>
      expect(screen.getByTestId("period-total-my-eur")).toHaveTextContent("0")
    );
    expect(screen.getByDisplayValue("500")).toBeInTheDocument();
  });

  it("the Settings icon toggles open and closed on repeated taps", async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText("Select group ▾");

    const settingsBtn = screen.getByRole("tab", { name: "Settings" });
    expect(settingsBtn).toHaveAttribute("aria-selected", "false");
    expect(screen.getByRole("tab", { name: "Edit" })).toHaveAttribute("aria-selected", "true");

    await user.click(settingsBtn);
    expect(settingsBtn).toHaveAttribute("aria-selected", "true");
    expect(await screen.findByRole("heading", { name: "Delete all data" })).toBeInTheDocument();

    // A second tap must close it again, back to Edit (where we started).
    await user.click(settingsBtn);
    expect(settingsBtn).toHaveAttribute("aria-selected", "false");
    expect(screen.getByRole("tab", { name: "Edit" })).toHaveAttribute("aria-selected", "true");
    expect(screen.queryByRole("heading", { name: "Delete all data" })).not.toBeInTheDocument();
  });

  it("closing Settings returns to Review if that's where the person was, not always Edit", async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText("Select group ▾");

    await user.click(screen.getByRole("tab", { name: "Review" }));
    const settingsBtn = screen.getByRole("tab", { name: "Settings" });
    await user.click(settingsBtn);
    expect(settingsBtn).toHaveAttribute("aria-selected", "true");

    await user.click(settingsBtn);
    expect(screen.getByRole("tab", { name: "Review" })).toHaveAttribute("aria-selected", "true");
  });

  it("a newly created period starts collapsed, matching the old app", async () => {
    const user = userEvent.setup();
    mockModalPrompt("Collapsed Test Group");

    render(<App />);
    await screen.findByText("Select group ▾");
    await openGroupMenu();
    await user.click(screen.getByRole("button", { name: "+ Group" }));

    await user.click(screen.getByRole("button", { name: "+ New period" }));

    // The client table/fields must NOT be visible until expanded.
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "+ Add client" })).not.toBeInTheDocument();

    // Expanding it reveals the table.
    await expandFirstPeriod(user);
    expect(screen.getByRole("table")).toBeInTheDocument();
  });

  it("the '+ Add period' button inside an expanded period adds another period to the same group", async () => {
    const user = userEvent.setup();
    mockModalPrompt("Extra Cycle Group");

    render(<App />);
    await screen.findByText("Select group ▾");
    await openGroupMenu();
    await user.click(screen.getByRole("button", { name: "+ Group" }));
    await user.click(screen.getByRole("button", { name: "+ New period" }));
    await expandFirstPeriod(user);

    await user.click(screen.getByRole("button", { name: "+ Add period" }));

    const periods = await db.periods.toArray();
    expect(periods).toHaveLength(2);
    expect(periods[0].groupId).toBe(periods[1].groupId);
  });

  it("the client table stays a real scrollable table (not stacked cards) with all six columns always present", async () => {
    const user = userEvent.setup();
    mockModalPrompt("Scroll Table Group");

    render(<App />);
    await screen.findByText("Select group ▾");
    await openGroupMenu();
    await user.click(screen.getByRole("button", { name: "+ Group" }));
    await user.click(screen.getByRole("button", { name: "+ New period" }));
    await expandFirstPeriod(user);
    await user.click(screen.getByRole("button", { name: "+ Add client" }));

    const table = screen.getByRole("table");
    const headers = within(table).getAllByRole("columnheader");
    expect(headers.map((h) => h.textContent)).toEqual([
      "Customer",
      "Gross",
      "Net",
      "City",
      "Done",
      "Actions",
    ]);
    // Headers must stay visible/present (not display:none, as a stacked
    // mobile layout would do) — getAllByRole already excludes hidden
    // elements, so finding all six here proves the header row is intact.
  });

  it("warns when a period's dates overlap another period in the same group, and only applies the change if confirmed", async () => {
    const user = userEvent.setup();
    mockModalPrompt("Overlap Group");

    render(<App />);
    await screen.findByText("Select group ▾");
    await openGroupMenu();
    await user.click(screen.getByRole("button", { name: "+ Group" }));
    await user.click(screen.getByRole("button", { name: "+ New period" }));
    await expandFirstPeriod(user);

    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2026-01-01" } });
    fireEvent.change(screen.getByLabelText("To"), { target: { value: "2026-01-31" } });

    const firstPeriodId = (await db.periods.toArray())[0].id;

    await user.click(screen.getByRole("button", { name: "+ Add period" }));
    const collapseButtons = screen.getAllByTestId("period-collapse-btn");
    await user.click(collapseButtons[1]);

    const fromInputs = screen.getAllByLabelText("From");
    const toInputs = screen.getAllByLabelText("To");

    // Set the second period's "To" first (no overlap check yet — "From" is
    // still empty, so the range isn't fully specified). Wait for the store
    // to actually reflect it before touching "From", so the overlap check
    // reads fresh state instead of a stale closure.
    fireEvent.change(toInputs[1], { target: { value: "2026-02-10" } });
    const secondPeriodId = (await waitFor(async () => {
      const all = await db.periods.toArray();
      const second = all.find((p) => p.id !== firstPeriodId && p.toDate === "2026-02-10");
      expect(second).toBeTruthy();
      return second!;
    })).id;

    // Overlapping range -> declined -> the change must NOT apply.
    mockModalConfirm(false);
    fireEvent.change(fromInputs[1], { target: { value: "2026-01-15" } });

    await waitFor(async () => {
      const p = await db.periods.get(secondPeriodId);
      expect(p?.fromDate).not.toBe("2026-01-15");
    });

    // Overlapping range -> confirmed -> the change DOES apply.
    mockModalConfirm(true);
    fireEvent.change(fromInputs[1], { target: { value: "2026-01-15" } });

    await waitFor(async () => {
      const p = await db.periods.get(secondPeriodId);
      expect(p?.fromDate).toBe("2026-01-15");
    });
  });

  it("warns when Net is unusually far from Gross (missing-digit sanity check)", async () => {
    const user = userEvent.setup();
    mockModalPrompt("Mismatch Group");

    render(<App />);
    await screen.findByText("Select group ▾");
    await openGroupMenu();
    await user.click(screen.getByRole("button", { name: "+ Group" }));
    await user.click(screen.getByRole("button", { name: "+ New period" }));
    await expandFirstPeriod(user);
    await user.click(screen.getByRole("button", { name: "+ Add client" }));

    const table = screen.getByRole("table");
    const [grossInput, netInput] = within(table).getAllByPlaceholderText("0");
    await user.type(grossInput, "1000");
    await user.type(netInput, "100"); // 900 off — should trigger the warning
    await user.tab();

    expect(
      await screen.findByText(/Net \(100\) looks far off from Gross \(1000\)/)
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Yes, it's correct" }));

    // The entered value is preserved either way — this is just a heads-up.
    expect(netInput).toHaveValue("100");
  });

  it("asks for confirmation before deleting a client row even when it's still completely empty", async () => {
    const user = userEvent.setup();
    mockModalPrompt("Empty Row Group");
    mockModalConfirm(false); // decline the very first time

    render(<App />);
    await screen.findByText("Select group ▾");
    await openGroupMenu();
    await user.click(screen.getByRole("button", { name: "+ Group" }));
    await user.click(screen.getByRole("button", { name: "+ New period" }));
    await expandFirstPeriod(user);
    await user.click(screen.getByRole("button", { name: "+ Add client" }));

    const table = screen.getByRole("table");
    // Row has no name/gross/net/city/comment entered at all yet.
    await user.click(within(table).getByRole("button", { name: "Remove" }));

    // Declined -> the row must still be there.
    expect(within(table).getByRole("button", { name: "Remove" })).toBeInTheDocument();

    mockModalConfirm(true);
    await user.click(within(table).getByRole("button", { name: "Remove" }));

    // Confirmed -> the row is actually gone.
    expect(within(table).queryByRole("button", { name: "Remove" })).not.toBeInTheDocument();
  });
});
