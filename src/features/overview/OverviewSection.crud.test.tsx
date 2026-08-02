import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, cleanup, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../../App";
import { resetAppForTest, openGroupMenu, expandFirstPeriod, mockModalPrompt } from "../../test/resetAppForTest";

describe("Overview page — matches the old app's business logic", () => {
  beforeEach(async () => {
    await resetAppForTest();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("KPI cards (Gross/Net/My€/Unpaid/Income) update automatically as data changes", async () => {
    const user = userEvent.setup();
    mockModalPrompt("Overview Group");

    render(<App />);
    await screen.findByText("Select group");

    await openGroupMenu();
    await user.click(screen.getByRole("button", { name: "+ Group" }));
    await user.click(screen.getByRole("button", { name: "+ New period" }));
    await expandFirstPeriod(user);
    await user.click(screen.getByRole("button", { name: "+ Add client" }));

    const overviewCard = screen.getByText("📊 Overview").closest("section")!;
    // Overview starts collapsed by default now — open it.
    await user.click(within(overviewCard).getByRole("button", { name: /Overview/ }));

    // Initially everything is zero.
    expect(within(overviewCard).getAllByText("€0").length).toBeGreaterThan(0);

    const table = screen.getByRole("table");
    const grossInput = within(table).getAllByPlaceholderText("0")[0];
    await user.type(grossInput, "1000");

    // Default group rate is 13.5%, Net not entered -> Gross is the My€ base,
    // and the same row is "Unpaid" (Gross entered, Net not entered).
    await waitFor(() => {
      const grossKpi = within(overviewCard).getByText("Gross").parentElement!;
      expect(grossKpi).toHaveTextContent("1000");
    });

    await waitFor(() => {
      const unpaidPill = within(overviewCard).getByText("Unpaid").parentElement!;
      expect(unpaidPill).toHaveTextContent("135"); // 1000 * 13.5%
    });

    // No salary configured for this group (default 0) -> income == unpaid.
    await waitFor(() => {
      const incomePill = within(overviewCard).getByText("Income").parentElement!;
      expect(incomePill).toHaveTextContent("135");
    });

    // Status badges update automatically when a row's status changes.
    const statusBtn = within(table).getByRole("button", { name: "—" });
    await user.click(statusBtn); // -> done
    await waitFor(() => {
      const statusRow = within(overviewCard).getByText(/Done \/ Fail/).parentElement!;
      expect(within(statusRow).getAllByText("1")[0]).toBeInTheDocument();
    });
  });

  it("configuring a group salary reduces Income relative to Unpaid", async () => {
    const user = userEvent.setup();
    mockModalPrompt("Salary Group");

    render(<App />);
    await screen.findByText("Select group");
    await openGroupMenu();
    await user.click(screen.getByRole("button", { name: "+ Group" }));

    // Set a default salary of 400/28days -> 100/week.
    const salaryInput = screen.getByLabelText("Default salary / 28d");
    await user.clear(salaryInput);
    await user.type(salaryInput, "400");

    await user.click(screen.getByRole("button", { name: "+ New period" }));
    await expandFirstPeriod(user);

    // A 1-week period with paidWeeks = 0 -> full week of salary owed.
    const fromInput = screen.getByLabelText("From");
    const toInput = screen.getByLabelText("To");
    await user.type(fromInput, "2026-01-01");
    await user.type(toInput, "2026-01-07");

    await user.click(screen.getByRole("button", { name: "+ Add client" }));
    const table = screen.getByRole("table");
    const grossInput = within(table).getAllByPlaceholderText("0")[0];
    await user.type(grossInput, "1000"); // unpaid = 1000 * 13.5% = 135

    const overviewCard = screen.getByText("📊 Overview").closest("section")!;
    // Overview starts collapsed by default now — open it.
    await user.click(within(overviewCard).getByRole("button", { name: /Overview/ }));

    await waitFor(() => {
      const unpaidPill = within(overviewCard).getByText("Unpaid").parentElement!;
      expect(unpaidPill).toHaveTextContent("135");
    });

    // salary owed = 100 (1 week * 100/week, 0 paid weeks) -> income = 135 - 100 = 35
    await waitFor(() => {
      const incomePill = within(overviewCard).getByText("Income").parentElement!;
      expect(incomePill).toHaveTextContent("35");
    });
  });

  it("clicking a status badge shows a scrollable list of matching clients, and clicking one jumps to it in Edit mode", async () => {
    const user = userEvent.setup();
    mockModalPrompt("Status Drilldown Group");

    render(<App />);
    await screen.findByText("Select group");

    await openGroupMenu();
    await user.click(screen.getByRole("button", { name: "+ Group" }));
    await user.click(screen.getByRole("button", { name: "+ New period" }));
    await expandFirstPeriod(user);
    await user.click(screen.getByRole("button", { name: "+ Add client" }));

    const table = screen.getByRole("table");
    await user.type(within(table).getByPlaceholderText("Client name"), "Drilldown Client");

    // Cycle the row's status to "done".
    const statusBtn = within(table).getByRole("button", { name: "—" });
    await user.click(statusBtn);

    const overviewCard = screen.getByText("📊 Overview").closest("section")!;
    // Overview starts collapsed by default now — open it.
    await user.click(within(overviewCard).getByRole("button", { name: /Overview/ }));

    // No client list until a badge is clicked.
    expect(within(overviewCard).queryByRole("list")).not.toBeInTheDocument();

    const doneBadge = await within(overviewCard).findByRole("button", { name: "1" });
    await user.click(doneBadge);

    const list = within(overviewCard).getByRole("list", { name: "Done clients" });
    expect(within(list).getByText("Drilldown Client")).toBeInTheDocument();

    // Clicking the badge again hides the list (toggle).
    await user.click(doneBadge);
    expect(within(overviewCard).queryByRole("list")).not.toBeInTheDocument();

    // Reopen and click the client — should jump to Edit mode and highlight it.
    await user.click(doneBadge);
    await user.click(within(overviewCard).getByText("Drilldown Client"));

    expect(await screen.findByRole("tab", { name: "Edit", selected: true })).toBeInTheDocument();
    expect(screen.getByDisplayValue("Drilldown Client")).toBeInTheDocument();
  });

  it("the Comments widget counts only clients with a non-empty comment, and clicking one jumps to it in Edit mode", async () => {
    const user = userEvent.setup();
    mockModalPrompt("Comments Group");

    render(<App />);
    await screen.findByText("Select group");

    await openGroupMenu();
    await user.click(screen.getByRole("button", { name: "+ Group" }));
    await user.click(screen.getByRole("button", { name: "+ New period" }));
    await expandFirstPeriod(user);

    // First client — has a comment.
    await user.click(screen.getByRole("button", { name: "+ Add client" }));
    let table = screen.getByRole("table");
    let rows = within(table).getAllByPlaceholderText("Client name");
    await user.type(rows[rows.length - 1], "Noted Client");
    await user.click(within(table).getAllByRole("button", { name: /Add note|Saved/ })[0]);
    await user.type(screen.getByPlaceholderText("Private note for this client..."), "Call back Monday");

    // Second client — left with no comment at all.
    await user.click(screen.getByRole("button", { name: "+ Add client" }));
    table = screen.getByRole("table");
    rows = within(table).getAllByPlaceholderText("Client name");
    await user.type(rows[rows.length - 1], "Silent Client");

    const overviewCard = screen.getByText("📊 Overview").closest("section")!;
    await user.click(within(overviewCard).getByRole("button", { name: /Overview/ }));

    // Only the ONE client with an actual comment is counted, not both.
    const commentsToggle = within(overviewCard).getByRole("button", { name: /📝 Comments/ });
    expect(within(commentsToggle).getByText("1")).toBeInTheDocument();

    expect(within(overviewCard).queryByRole("list")).not.toBeInTheDocument();
    await user.click(commentsToggle);

    const list = within(overviewCard).getByRole("list", { name: "Clients with comments" });
    expect(within(list).getByText("Noted Client")).toBeInTheDocument();
    expect(within(list).getByText("Call back Monday")).toBeInTheDocument();
    expect(within(list).queryByText("Silent Client")).not.toBeInTheDocument();

    // Toggle closed.
    await user.click(commentsToggle);
    expect(within(overviewCard).queryByRole("list")).not.toBeInTheDocument();

    // Reopen and jump to the client — same navigate/highlight behavior as
    // the status badges use.
    await user.click(commentsToggle);
    await user.click(within(overviewCard).getByText("Noted Client"));

    expect(await screen.findByRole("tab", { name: "Edit", selected: true })).toBeInTheDocument();
    expect(screen.getByDisplayValue("Noted Client")).toBeInTheDocument();
  });

  it("the Comments count respects Current vs All scope, counting only the active group unless All is selected", async () => {
    const user = userEvent.setup();
    mockModalPrompt("Group A");

    render(<App />);
    await screen.findByText("Select group");

    // Group A: one client with a comment.
    await openGroupMenu();
    await user.click(screen.getByRole("button", { name: "+ Group" }));
    await user.click(screen.getByRole("button", { name: "+ New period" }));
    await expandFirstPeriod(user);
    await user.click(screen.getByRole("button", { name: "+ Add client" }));
    let table = screen.getByRole("table");
    await user.type(within(table).getByPlaceholderText("Client name"), "A Client");
    await user.click(within(table).getByRole("button", { name: /Add note|Saved/ }));
    await user.type(screen.getByPlaceholderText("Private note for this client..."), "note A");

    // Group B: a different client, also with a comment. (The group menu
    // is already open from creating Group A — it doesn't auto-close.)
    mockModalPrompt("Group B");
    await user.click(screen.getByRole("button", { name: "+ Group" }));
    await user.click(screen.getByRole("button", { name: "+ New period" }));
    await expandFirstPeriod(user);
    await user.click(screen.getByRole("button", { name: "+ Add client" }));
    table = screen.getByRole("table");
    await user.type(within(table).getByPlaceholderText("Client name"), "B Client");
    await user.click(within(table).getByRole("button", { name: /Add note|Saved/ }));
    await user.type(screen.getByPlaceholderText("Private note for this client..."), "note B");

    // Now viewing Group B (the active one) — "Current" scope must show
    // only Group B's one commented client, not Group A's.
    const overviewCard = screen.getByText("📊 Overview").closest("section")!;
    await user.click(within(overviewCard).getByRole("button", { name: /Overview/ }));

    const commentsToggle = within(overviewCard).getByRole("button", { name: /📝 Comments/ });
    expect(within(commentsToggle).getByText("1")).toBeInTheDocument();

    // Switching to "All" must count both groups' commented clients together.
    await user.click(within(overviewCard).getByRole("button", { name: "All" }));
    expect(within(commentsToggle).getByText("2")).toBeInTheDocument();
  });
});
