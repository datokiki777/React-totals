import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../../App";
import { db } from "../../db/database";
import { useAppStore } from "../../app/store";
import { resetAppForTest } from "../../test/resetAppForTest";

describe("PIN Lock — end to end", () => {
  beforeEach(async () => {
    await resetAppForTest();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("the app loads normally (no lock screen) when PIN lock has never been enabled", async () => {
    render(<App />);
    expect(await screen.findByText("Select group ▾")).toBeInTheDocument();
    expect(screen.queryByLabelText("PIN")).not.toBeInTheDocument();
  });

  it("enabling a PIN in Settings verifies this device immediately — no lock screen appears yet", async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText("Select group ▾");

    await user.click(screen.getByRole("tab", { name: "Settings" }));
    const [newPinInput, confirmPinInput] = screen.getAllByLabelText(/PIN/, { selector: "input" });
    await user.type(newPinInput, "482913");
    await user.type(confirmPinInput, "482913");
    await user.click(screen.getByRole("button", { name: "Enable PIN lock" }));

    await waitFor(async () => {
      expect((await db.settings.get("app"))?.pinEnabled).toBe(true);
    });
    // Still on the settings screen, not locked out — this device auto-verifies.
    expect(screen.getByRole("heading", { name: "PIN Lock" })).toBeInTheDocument();
  });

  it("a locked-out device (PIN enabled, not yet verified) shows the lock screen and blocks the app until the correct PIN is entered", async () => {
    // Simulate the PIN already being set (e.g. from another device via
    // cloud sync) but this device hasn't verified it yet.
    const { hashPin } = await import("../../shared/lib/pin");
    await db.settings.put({
      id: "app",
      defaultRate: 13.5,
      defaultSalary: 0,
      currencySymbol: "€",
      confirmDestructiveActions: true,
      pinEnabled: true,
      pinHash: await hashPin("135790"),
    });

    const user = userEvent.setup();
    render(<App />);

    // The app content must NOT be reachable yet.
    const pinInput = await screen.findByLabelText("PIN");
    expect(screen.queryByText("Select group ▾")).not.toBeInTheDocument();

    // Wrong PIN -> stays locked, shows an error.
    await user.type(pinInput, "000000");
    await user.click(screen.getByRole("button", { name: "Unlock" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/Incorrect PIN/);
    expect(screen.queryByText("Select group ▾")).not.toBeInTheDocument();

    // Correct PIN -> unlocks and the normal app appears.
    await user.clear(pinInput);
    await user.type(pinInput, "135790");
    await user.click(screen.getByRole("button", { name: "Unlock" }));

    expect(await screen.findByText("Select group ▾")).toBeInTheDocument();
    expect(useAppStore.getState().deviceVerified).toBe(true);
  });

  it("disabling PIN lock from Settings requires the current PIN and then removes the requirement", async () => {
    await useAppStore.getState().setPinLock({ enabled: true, newPin: "112233" });

    const user = userEvent.setup();
    render(<App />);
    await screen.findByText("Select group ▾");
    await user.click(screen.getByRole("tab", { name: "Settings" }));

    const currentPinInput = screen.getByLabelText("Current PIN");
    await user.type(currentPinInput, "112233");
    await user.click(screen.getByRole("button", { name: "Disable PIN lock" }));

    await waitFor(async () => {
      expect((await db.settings.get("app"))?.pinEnabled).toBe(false);
    });
    expect(useAppStore.getState().deviceVerified).toBe(false);
  });
});
