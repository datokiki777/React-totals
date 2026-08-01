import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../../App";
import { resetAppForTest, openGroupMenu, expandFirstPeriod } from "../../test/resetAppForTest";

async function setupOneClient(user: ReturnType<typeof userEvent.setup>) {
  await openGroupMenu();
  await user.click(screen.getByRole("button", { name: "+ Group" }));
  await screen.findByRole("button", { name: "+ New period" });
  await user.click(screen.getByRole("button", { name: "+ New period" }));
    await expandFirstPeriod(user);
  await screen.findByRole("button", { name: "+ Client" });
  await user.click(screen.getByRole("button", { name: "+ Client" }));

  const table = screen.getByRole("table");
  await user.type(within(table).getByPlaceholderText("Client name"), "Acme Corp");
  await user.type(within(table).getByPlaceholderText("City"), "Tbilisi");
  await user.click(within(table).getByRole("button", { name: /Add note|Note/ }));
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
    vi.spyOn(window, "prompt").mockReturnValue("Search Group");

    render(<App />);
    await screen.findByText("Select group ▾");
    await setupOneClient(user);

    await user.click(screen.getByRole("tab", { name: "Review" }));

    const searchInput = screen.getByPlaceholderText(/Search client/);
    await user.type(searchInput, "acme"); // partial + lowercase

    expect(await screen.findByText("Corp")).toBeInTheDocument(); // highlighted remainder of "Acme Corp"
  });

  it("finds a client by partial address/city match", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "prompt").mockReturnValue("Search Group");

    render(<App />);
    await screen.findByText("Select group ▾");
    await setupOneClient(user);

    await user.click(screen.getByRole("tab", { name: "Review" }));
    await user.type(screen.getByPlaceholderText(/Search client/), "bilis");

    expect(await screen.findByText("Acme Corp")).toBeInTheDocument();
  });

  it("finds a client by partial comment/notes match", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "prompt").mockReturnValue("Search Group");

    render(<App />);
    await screen.findByText("Select group ▾");
    await setupOneClient(user);

    await user.click(screen.getByRole("tab", { name: "Review" }));
    await user.type(screen.getByPlaceholderText(/Search client/), "discount");

    expect(await screen.findByText("Acme Corp")).toBeInTheDocument();
  });

  it("shows 'No results' for a query that matches nothing, and clears instantly as you type", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "prompt").mockReturnValue("Search Group");

    render(<App />);
    await screen.findByText("Select group ▾");
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
    vi.spyOn(window, "prompt").mockReturnValue("Search Group");
    vi.spyOn(window, "confirm").mockReturnValue(true);

    render(<App />);
    await screen.findByText("Select group ▾");
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
    vi.spyOn(window, "prompt").mockReturnValue("Browse Group");

    render(<App />);
    await screen.findByText("Select group ▾");
    await setupOneClient(user);

    await user.click(screen.getByRole("tab", { name: "Review" }));

    // Group card starts collapsed; expand it. (The GroupSwitcher picker
    // button also contains the group name, so disambiguate via aria-expanded,
    // which only the ReviewList toggle exposes.)
    const groupToggle = screen.getByRole("button", { name: /Browse Group/, expanded: false });
    await user.click(groupToggle);

    // Period card (native <details>) — expand to see the client list.
    const periodSummary = await screen.findByText(/clients/);
    await user.click(periodSummary);

    expect(await screen.findByText("Acme Corp")).toBeInTheDocument();
    expect(screen.getByText(/wants a discount/)).toBeInTheDocument();
  });
});
