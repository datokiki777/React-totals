import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../../App";
import { db } from "../../db/database";
import { useAppStore } from "../../app/store";
import { resetAppForTest } from "../../test/resetAppForTest";
import { REQUIRED_PIN } from "../../shared/lib/pin";

/** resetAppForTest() defaults every test to an already-verified device (so
 * unrelated e2e tests don't have to deal with the PIN gate) — these tests
 * are specifically about that gate, so they simulate a genuinely fresh,
 * unverified device instead. */
async function simulateFreshDevice() {
  await db.deviceSecurity.clear();
  useAppStore.setState({ deviceVerified: false });
}

describe("PIN Lock — automatic, fixed PIN, end to end", () => {
  beforeEach(async () => {
    await resetAppForTest();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("a brand-new device is asked for the PIN immediately — the app content is not reachable yet", async () => {
    await simulateFreshDevice();
    render(<App />);
    const pinInput = await screen.findByLabelText("PIN");
    expect(pinInput).toBeInTheDocument();
    expect(screen.queryByText("Select group ▾")).not.toBeInTheDocument();
  });

  it("there is no Settings UI to configure or disable the PIN — it's automatic and fixed", async () => {
    const user = userEvent.setup();
    render(<App />); // already-verified device, per resetAppForTest's default
    await screen.findByText("Select group ▾");
    await user.click(screen.getByRole("tab", { name: "Settings" }));

    expect(screen.queryByRole("heading", { name: "PIN Lock" })).not.toBeInTheDocument();
  });

  it("a wrong PIN stays locked and shows an error", async () => {
    await simulateFreshDevice();
    const user = userEvent.setup();
    render(<App />);

    const pinInput = await screen.findByLabelText("PIN");
    await user.type(pinInput, "0000");
    await user.click(screen.getByRole("button", { name: "Unlock" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/Incorrect PIN/);
    expect(screen.queryByText("Select group ▾")).not.toBeInTheDocument();
    expect(useAppStore.getState().deviceVerified).toBe(false);
  });

  it("the correct PIN unlocks the app and remembers this device", async () => {
    await simulateFreshDevice();
    const user = userEvent.setup();
    render(<App />);

    const pinInput = await screen.findByLabelText("PIN");
    await user.type(pinInput, REQUIRED_PIN);
    await user.click(screen.getByRole("button", { name: "Unlock" }));

    expect(await screen.findByText("Select group ▾")).toBeInTheDocument();
    expect(useAppStore.getState().deviceVerified).toBe(true);
    expect((await db.deviceSecurity.get("device"))?.verified).toBe(true);
  });

  it("a device that already verified itself (e.g. a previous session) skips the lock screen entirely", async () => {
    render(<App />); // resetAppForTest already marks this device verified

    expect(await screen.findByText("Select group ▾")).toBeInTheDocument();
    expect(screen.queryByLabelText("PIN")).not.toBeInTheDocument();
  });
});
