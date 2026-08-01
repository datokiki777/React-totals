import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../App";
import { useAppStore } from "../app/store";
import { resetAppForTest } from "../test/resetAppForTest";

describe("Cloud Sync settings — sign-in form", () => {
  beforeEach(async () => {
    await resetAppForTest();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("shows a sign-in form (never a blocking gate) when nobody is signed in yet", async () => {
    const user = userEvent.setup();
    render(<App />);

    // The app itself is immediately usable — Cloud Sync is opt-in, not a
    // gate blocking the rest of the app.
    await screen.findByText("Select group ▾");

    await user.click(screen.getByRole("tab", { name: "Settings" }));

    expect(screen.getByRole("heading", { name: "Cloud Sync" })).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
  });

  it("shows a validation message instead of attempting a sign-in with empty fields", async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText("Select group ▾");
    await user.click(screen.getByRole("tab", { name: "Settings" }));

    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/Enter both email and password/);
  });
});

describe("Cloud Sync settings — signed-in view", () => {
  beforeEach(async () => {
    await resetAppForTest();
    // Simulate an already-signed-in device — a real Firebase sign-in isn't
    // possible in this test environment, so the store is set directly,
    // exactly as onAuthStateChanged would have done.
    useAppStore.setState({ cloudUserEmail: "person@example.com" });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("Save/Load are on one row with cloud icons, and a Data & Backup details button lives at the bottom", async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText("Select group ▾");
    await user.click(screen.getByRole("tab", { name: "Settings" }));

    const saveBtn = screen.getByRole("button", { name: "☁️ Save to cloud now" });
    const loadBtn = screen.getByRole("button", { name: "☁️ Load from cloud" });
    expect(saveBtn).toBeInTheDocument();
    expect(loadBtn).toBeInTheDocument();
    // Same parent row, not wrapped onto separate lines.
    expect(saveBtn.parentElement).toBe(loadBtn.parentElement);

    expect(screen.getByRole("button", { name: "💾 Data & Backup details" })).toBeInTheDocument();
  });

  it("the Data & Backup details button opens a stats panel with active/archive breakdown and backup status", async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText("Select group ▾");
    await user.click(screen.getByRole("tab", { name: "Settings" }));

    await user.click(screen.getByRole("button", { name: "💾 Data & Backup details" }));

    expect(screen.getByText("💾 Data & Backup")).toBeInTheDocument();
    expect(screen.getByText("No backups yet")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByText("💾 Data & Backup")).not.toBeInTheDocument();
  });
});
