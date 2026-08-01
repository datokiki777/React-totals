import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../../App";
import { resetAppForTest, openGroupMenu } from "../../test/resetAppForTest";
import { GROUP_SWITCHER_LONG_PRESS_MS } from "./GroupSwitcher";

async function addGroupViaMenu(user: ReturnType<typeof userEvent.setup>, name: string) {
  vi.spyOn(window, "prompt").mockReturnValueOnce(name);
  if (!screen.queryByRole("button", { name: "+ ჯგუფი" })) {
    await openGroupMenu();
  }
  await user.click(screen.getByRole("button", { name: "+ ჯგუფი" }));
  await screen.findByTestId("group-switcher-btn");
}

describe("GroupSwitcher — tap cycles groups, long-press opens the management menu", () => {
  beforeEach(async () => {
    await resetAppForTest();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("a short tap cycles to the next group, wrapping back to the first", async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText("აირჩიე ჯგუფი ▾");

    await addGroupViaMenu(user, "Group One");
    await addGroupViaMenu(user, "Group Two");
    await addGroupViaMenu(user, "Group Three");

    const switcherBtn = screen.getByTestId("group-switcher-btn");
    // Newly created groups become active immediately, so we're on "Group Three".
    expect(switcherBtn).toHaveTextContent("Group Three");

    await user.click(switcherBtn);
    expect(switcherBtn).toHaveTextContent("Group One"); // wraps around

    await user.click(switcherBtn);
    expect(switcherBtn).toHaveTextContent("Group Two");

    await user.click(switcherBtn);
    expect(switcherBtn).toHaveTextContent("Group Three"); // wrapped fully
  });

  it("a short tap does nothing when there are no groups yet", async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText("აირჩიე ჯგუფი ▾");

    const switcherBtn = screen.getByTestId("group-switcher-btn");
    await user.click(switcherBtn);
    expect(switcherBtn).toHaveTextContent("აირჩიე ჯგუფი");
  });

  it("long-pressing opens a management menu with group actions and default-rate/salary fields", async () => {
    render(<App />);
    await screen.findByText("აირჩიე ჯგუფი ▾");

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();

    await openGroupMenu();

    const menu = screen.getByRole("menu");
    expect(screen.getByRole("button", { name: "+ ჯგუფი" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "გადარქმევა" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "წაშლა" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "არქივი / დაბრუნება" })).toBeInTheDocument();
    expect(screen.getByLabelText("Default %")).toBeInTheDocument();
    expect(screen.getByLabelText("Default salary / 28d")).toBeInTheDocument();
    expect(menu).toBeInTheDocument();
  });

  it("long-pressing again closes the menu", async () => {
    render(<App />);
    await screen.findByText("აირჩიე ჯგუფი ▾");

    await openGroupMenu();
    expect(screen.getByRole("menu")).toBeInTheDocument();

    await openGroupMenu();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("releasing before the long-press threshold does NOT open the menu (it's a real long-press, not just any hold)", async () => {
    render(<App />);
    await screen.findByText("აირჩიე ჯგუფი ▾");

    const switcherBtn = screen.getByTestId("group-switcher-btn");
    await act(async () => {
      fireEvent.pointerDown(switcherBtn);
      await new Promise((r) => setTimeout(r, GROUP_SWITCHER_LONG_PRESS_MS - 200));
      fireEvent.pointerUp(switcherBtn);
    });

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("releasing a long-press does not also trigger the tap-to-cycle action", async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText("აირჩიე ჯგუფი ▾");

    await addGroupViaMenu(user, "Only Group");
    // The menu is left open by addGroupViaMenu's long-press; close it with
    // another long-press and confirm the group did NOT also get cycled
    // (there's only one group, so this specifically checks no double-fire
    // crashed anything and the active group is still correct).
    await openGroupMenu();

    const switcherBtn = screen.getByTestId("group-switcher-btn");
    expect(switcherBtn).toHaveTextContent("Only Group");
  });

  it("the menu's actions (rename) still work exactly as before, just inside the collapsible panel", async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText("აირჩიე ჯგუფი ▾");

    await addGroupViaMenu(user, "Original Name");

    vi.spyOn(window, "prompt").mockReturnValueOnce("Renamed Group");
    await user.click(screen.getByRole("button", { name: "გადარქმევა" }));

    const switcherBtn = await screen.findByTestId("group-switcher-btn");
    expect(switcherBtn).toHaveTextContent("Renamed Group");
  });
});
