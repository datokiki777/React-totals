import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../App";
import { db } from "../db/database";

async function resetDb() {
  await db.groups.clear();
  await db.periods.clear();
  await db.clientRows.clear();
}

describe("Client table CRUD (end-to-end against real IndexedDB)", () => {
  beforeEach(async () => {
    await resetDb();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("adds a group, a period, and a client row; edits persist to IndexedDB; My€ is correct", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "prompt").mockReturnValue("Test Group");

    render(<App />);

    // Wait for initial load to finish.
    expect(await screen.findByText("აირჩიე ჯგუფი ▾")).toBeInTheDocument();

    // 1. Create a group.
    await user.click(screen.getByRole("button", { name: "+ ჯგუფი" }));
    expect(await screen.findByRole("button", { name: /Test Group/ })).toBeInTheDocument();

    // 2. Create a period.
    await user.click(screen.getByRole("button", { name: "+ ახალი პერიოდი" }));
    expect(await screen.findByText("+ კლიენტი")).toBeInTheDocument();

    // 3. Add a client row.
    await user.click(screen.getByRole("button", { name: "+ კლიენტი" }));

    const table = screen.getByRole("table");
    const customerInput = within(table).getByPlaceholderText("კლიენტის სახელი");
    const grossInputs = within(table).getAllByPlaceholderText("0");
    const [grossInput, netInput] = grossInputs;
    const cityInput = within(table).getByPlaceholderText("ქალაქი");

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
    expect(periodsAfter[0].defaultRate).toBe(13.5);

    // Expected My€ = gross (1000) * 13.5% = 135, since Net is not entered.
    await screen.findByTestId("period-total-my-eur");
    expect(screen.getByTestId("period-total-my-eur")).toHaveTextContent("135.00");

    // 5. Now enter an explicit Net of "0" — My€ must become 0 (base = Net, not Gross),
    // exactly matching the old app's semantics for an explicitly-entered zero.
    await user.type(netInput, "0");
    await waitFor(() =>
      expect(screen.getByTestId("period-total-my-eur")).toHaveTextContent("0.00")
    );

    const rowsAfterNetZero = await db.clientRows.toArray();
    expect(rowsAfterNetZero[0].net).toBe("0");

    // 6. Delete the row (confirm dialog must be accepted).
    vi.spyOn(window, "confirm").mockReturnValue(true);
    await user.click(within(table).getByRole("button", { name: "წაშლა" }));

    const rowsAfterDelete = await db.clientRows.toArray();
    expect(rowsAfterDelete).toHaveLength(0);
  });

  it("excludes rows marked 'wrong' from My€ but keeps them visible in the table", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "prompt").mockReturnValue("Group W");

    render(<App />);

    await screen.findByText("აირჩიე ჯგუფი ▾");
    await user.click(screen.getByRole("button", { name: "+ ჯგუფი" }));
    await user.click(screen.getByRole("button", { name: "+ ახალი პერიოდი" }));
    await user.click(screen.getByRole("button", { name: "+ კლიენტი" }));

    const table = screen.getByRole("table");
    const grossInput = within(table).getAllByPlaceholderText("0")[0];
    await user.type(grossInput, "500");

    await waitFor(() =>
      expect(screen.getByTestId("period-total-my-eur")).toHaveTextContent("67.50")
    ); // 500 * 13.5%

    // Cycle status: none -> done -> fail -> fixed -> wrong
    const statusBtn = within(table).getByRole("button", { name: "—" });
    await user.click(statusBtn); // done
    await user.click(screen.getByRole("button", { name: "✓ Done" })); // fail
    await user.click(screen.getByRole("button", { name: "✕ Fail" })); // fixed
    await user.click(screen.getByRole("button", { name: "⟳ Fixed" })); // wrong

    expect(await screen.findByRole("button", { name: "! Wrong" })).toBeInTheDocument();

    // Row is still visible with its data, but excluded from totals -> 0.00
    await waitFor(() =>
      expect(screen.getByTestId("period-total-my-eur")).toHaveTextContent("0.00")
    );
    expect(screen.getByDisplayValue("500")).toBeInTheDocument();
  });
});
