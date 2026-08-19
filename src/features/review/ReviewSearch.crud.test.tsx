import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, cleanup, within, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../../App";
import { resetAppForTest, openGroupMenu, expandFirstPeriod, mockModalPrompt, mockModalConfirm } from "../../test/resetAppForTest";

async function setupOneClient(user: ReturnType<typeof userEvent.setup>) {
  await openGroupMenu();
  await user.click(screen.getByRole("button", { name: "+ Group" }));
  await screen.findByRole("button", { name: "+ New period" });
  await user.click(screen.getByRole("button", { name: "+ New period" }));
    await expandFirstPeriod(user);
  await screen.findByRole("button", { name: "+ Add client" });
  await user.click(screen.getByRole("button", { name: "+ Add client" }));

  const table = screen.getByRole("table");
  await user.type(within(table).getByPlaceholderText("Client name"), "Acme Corp");
  await user.type(within(table).getByPlaceholderText("City"), "Tbilisi");
  await user.click(within(table).getByRole("button", { name: /Add note|Saved/ }));
  await user.type(screen.getByPlaceholderText("Private note for this client..."), "wants a discount");
}

describe("Review/Search module — matches the old app's search behavior", () => {
  beforeEach(async () => {
    await resetAppForTest();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("finds a client by partial name match, with no page reload (pure client-side filtering)", async () => {
    const user = userEvent.setup();
    mockModalPrompt("Search Group");

    render(<App />);
    await screen.findByText("Select group");
    await setupOneClient(user);

    await user.click(screen.getByRole("tab", { name: "Review" }));

    const searchInput = screen.getByPlaceholderText(/Search client/);
    await user.type(searchInput, "acme"); // partial + lowercase

    expect(await screen.findByText("Corp")).toBeInTheDocument(); // highlighted remainder of "Acme Corp"
  });

  it("finds a client by partial address/city match", async () => {
    const user = userEvent.setup();
    mockModalPrompt("Search Group");

    render(<App />);
    await screen.findByText("Select group");
    await setupOneClient(user);

    await user.click(screen.getByRole("tab", { name: "Review" }));
    await user.type(screen.getByPlaceholderText(/Search client/), "bilis");

    // Scoped to the search-result button specifically — "Acme Corp" is
    // now also always visible in the Review list body below, since
    // group cards no longer collapse.
    expect(await screen.findByRole("button", { name: /Acme Corp/ })).toBeInTheDocument();
  });

  it("finds a client by partial comment/notes match", async () => {
    const user = userEvent.setup();
    mockModalPrompt("Search Group");

    render(<App />);
    await screen.findByText("Select group");
    await setupOneClient(user);

    await user.click(screen.getByRole("tab", { name: "Review" }));
    await user.type(screen.getByPlaceholderText(/Search client/), "discount");

    expect(await screen.findByRole("button", { name: /Acme Corp/ })).toBeInTheDocument();
  });

  it("shows 'No results' for a query that matches nothing, and clears instantly as you type", async () => {
    const user = userEvent.setup();
    mockModalPrompt("Search Group");

    render(<App />);
    await screen.findByText("Select group");
    await setupOneClient(user);

    await user.click(screen.getByRole("tab", { name: "Review" }));
    const searchInput = screen.getByPlaceholderText(/Search client/);

    await user.type(searchInput, "zzz-nomatch");
    expect(await screen.findByText("No results")).toBeInTheDocument();

    await user.clear(searchInput);
    // With an empty query the results dropdown should disappear entirely.
    expect(screen.queryByText("No results")).not.toBeInTheDocument();
  });

  it("clicking a result opens the client in Edit mode and highlights its row", async () => {
    const user = userEvent.setup();
    mockModalPrompt("Search Group");
    mockModalConfirm(true);

    render(<App />);
    await screen.findByText("Select group");
    await setupOneClient(user);

    await user.click(screen.getByRole("tab", { name: "Review" }));
    await user.type(screen.getByPlaceholderText(/Search client/), "acme");

    const resultButton = (await screen.findByText("Corp")).closest("button")!;
    await user.click(resultButton);

    // Should have switched back to Edit mode automatically.
    expect(await screen.findByRole("table")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Acme Corp")).toBeInTheDocument();
  });

  it("Review browse list shows the group/period/client hierarchy read-only", async () => {
    const user = userEvent.setup();
    mockModalPrompt("Browse Group");

    render(<App />);
    await screen.findByText("Select group");
    await setupOneClient(user);

    await user.click(screen.getByRole("tab", { name: "Review" }));

    // Group cards are always expanded in Review mode now — no toggle to click.

    // Period card (native <details>) — expand to see the client list.
    const periodSummary = await screen.findByText(/clients/);
    await user.click(periodSummary);

    expect(await screen.findByText("Acme Corp")).toBeInTheDocument();
    expect(screen.getByText(/wants a discount/)).toBeInTheDocument();
  });

  it("a collapsed group card shows every status color present (not just Done), matching the old app", async () => {
    const user = userEvent.setup();
    mockModalPrompt("Multi Status Group");

    render(<App />);
    await screen.findByText("Select group");
    await openGroupMenu();
    await user.click(screen.getByRole("button", { name: "+ Group" }));
    await user.click(screen.getByRole("button", { name: "+ New period" }));
    await expandFirstPeriod(user);

    const table = screen.getByRole("table");

    // Row 1 -> Done (1 click), Row 2 -> Fail (2 clicks), Row 3 -> Fixed
    // (3 clicks), Row 4 -> Wrong (4 clicks).
    for (let i = 0; i < 4; i++) {
      await user.click(screen.getByRole("button", { name: "+ Add client" }));
    }
    const statusButtons = within(table).getAllByRole("button", { name: "—" });
    expect(statusButtons).toHaveLength(4);
    for (let row = 0; row < 4; row++) {
      for (let clicks = 0; clicks <= row; clicks++) {
        await user.click(statusButtons[row]);
      }
    }

    await user.click(screen.getByRole("tab", { name: "Review" }));

    // Group card is always expanded now — must show all four status
    // colors at once, not just a single green "total" badge. Scoped to
    // just the header row (not the whole section) since the body below
    // is always rendered too now and has its own numeric-looking text
    // (money amounts) that would otherwise pollute this count.
    const groupHeading = screen.getByRole("heading", { name: "Multi Status Group" });
    const groupHeader = groupHeading.closest("section")!.firstElementChild as HTMLElement;
    // The badge classes are hashed by CSS Modules, so assert by the
    // actual visible counts instead of a specific class name.
    const badgeTexts = within(groupHeader)
      .getAllByText(/^[0-9]+$/)
      .map((el) => el.textContent);
    expect(badgeTexts).toEqual(["1", "1", "1", "1"]); // Done, Fail, Fixed, Wrong
  });

  it("the period's paid-weeks badge is red when underpaid and turns green once fully paid", async () => {
    const user = userEvent.setup();
    mockModalPrompt("Paid Weeks Group");

    render(<App />);
    await screen.findByText("Select group");
    await openGroupMenu();
    await user.click(screen.getByRole("button", { name: "+ Group" }));
    await user.click(screen.getByRole("button", { name: "+ New period" }));
    await expandFirstPeriod(user);

    // 14-day span = exactly 2 weeks.
    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2026-01-01" } });
    fireEvent.change(screen.getByLabelText("To"), { target: { value: "2026-01-15" } });
    fireEvent.change(screen.getByLabelText("Paid Weeks"), { target: { value: "1" } });

    await user.click(screen.getByRole("tab", { name: "Review" }));
    // Group card is always expanded now — no toggle to click.

    const badge = await screen.findByText("💰 1w / 2w");
    expect(badge.className).toMatch(/badgeUnpaid/);

    // Bump paid weeks up to fully cover the period's actual span.
    await user.click(screen.getByRole("tab", { name: "Edit" }));
    await expandFirstPeriod(user); // periods remount collapsed when leaving/returning to Edit
    fireEvent.change(screen.getByLabelText("Paid Weeks"), { target: { value: "2" } });
    await user.click(screen.getByRole("tab", { name: "Review" }));

    const paidBadge = await screen.findByText("💰 2w / 2w");
    expect(paidBadge.className).toContain("badgePaid");
    expect(paidBadge.className).not.toContain("badgeUnpaid");
  });

  it("Review mode also lists a group's periods in date order, not creation order", async () => {
    const user = userEvent.setup();
    mockModalPrompt("Review Sort Group");

    render(<App />);
    await screen.findByText("Select group");
    await openGroupMenu();
    await user.click(screen.getByRole("button", { name: "+ Group" }));

    // Create the LATER-dated period first...
    await user.click(screen.getByRole("button", { name: "+ New period" }));
    await expandFirstPeriod(user);
    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2026-06-01" } });
    fireEvent.change(screen.getByLabelText("To"), { target: { value: "2026-06-08" } });

    // ...then the EARLIER-dated one second.
    await user.click(screen.getByRole("button", { name: "+ Add period" }));
    const collapseButtons = screen.getAllByTestId("period-collapse-btn");
    await user.click(collapseButtons[1]);
    const fromInputs = screen.getAllByLabelText("From");
    const toInputs = screen.getAllByLabelText("To");
    fireEvent.change(toInputs[1], { target: { value: "2026-01-08" } });
    fireEvent.change(fromInputs[1], { target: { value: "2026-01-01" } });

    await user.click(screen.getByRole("tab", { name: "Review" }));
    // Group card is always expanded now — no toggle to click.

    const ranges = await screen.findAllByText(/\d{2}\/\d{2}\/2026 → \d{2}\/\d{2}\/2026/);
    expect(ranges[0]).toHaveTextContent("01/01/2026 → 08/01/2026");
    expect(ranges[1]).toHaveTextContent("01/06/2026 → 08/06/2026");
  });

  it("a manual reorder in Edit mode's sort mode shows up immediately in Review mode too, with no reload needed", async () => {
    const user = userEvent.setup();
    mockModalPrompt("Live Sort Group");

    render(<App />);
    await screen.findByText("Select group");
    await openGroupMenu();
    await user.click(screen.getByRole("button", { name: "+ Group" }));
    await user.click(screen.getByRole("button", { name: "+ New period" }));
    await expandFirstPeriod(user);

    for (const name of ["First", "Second"]) {
      await user.click(screen.getByRole("button", { name: "+ Add client" }));
      const table = screen.getByRole("table");
      const inputs = within(table).getAllByPlaceholderText("Client name");
      await user.type(inputs[inputs.length - 1], name);
    }

    // Move "Second" above "First" using the sort-mode buttons.
    await user.click(screen.getByRole("checkbox", { name: "Sort clients" }));
    await user.click(screen.getAllByLabelText("Move client up")[1]);
    await user.click(screen.getByRole("checkbox", { name: "Sort clients" }));

    // Switch straight to Review — no reload, no remount — and confirm it
    // already reflects the new order, not the original typing order.
    await user.click(screen.getByRole("tab", { name: "Review" }));
    await screen.findByText("Second");
    const bodyText = document.body.textContent ?? "";
    expect(bodyText.indexOf("Second")).toBeLessThan(bodyText.indexOf("First"));
  });
});
