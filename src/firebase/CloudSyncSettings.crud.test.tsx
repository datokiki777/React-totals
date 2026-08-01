import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../App";
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
