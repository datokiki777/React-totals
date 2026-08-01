import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, cleanup, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../../App";
import { db } from "../../db/database";
import { resetAppForTest, openGroupMenu } from "../../test/resetAppForTest";

async function openSettings(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("tab", { name: /პარამეტრები/ }));
  await screen.findByRole("heading", { name: "ყველა მონაცემის წაშლა" });
}

describe("Settings — defaults, currency display, destructive-action confirmation, clear data", () => {
  beforeEach(async () => {
    await resetAppForTest();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("uses the configured default rate/salary for newly created groups", async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText("აირჩიე ჯგუფი ▾");
    await openSettings(user);

    const rateInput = screen.getByLabelText("ნაგულისხმევი საკომისიო %");
    await user.clear(rateInput);
    await user.type(rateInput, "22.5");

    const salaryInput = screen.getByLabelText("ნაგულისხმევი ხელფასი / 28დღე");
    await user.clear(salaryInput);
    await user.type(salaryInput, "500");

    await waitFor(async () => {
      const stored = await db.settings.get("app");
      expect(stored?.defaultRate).toBe(22.5);
      expect(stored?.defaultSalary).toBe(500);
    });

    // Go back to Edit and create a group — it should pick up the new defaults.
    await user.click(screen.getByRole("tab", { name: "რედაქტირება" }));
    vi.spyOn(window, "prompt").mockReturnValue("New Defaults Group");
    await openGroupMenu();
    await user.click(screen.getByRole("button", { name: "+ ჯგუფი" }));

    await waitFor(async () => {
      const groups = await db.groups.toArray();
      expect(groups).toHaveLength(1);
      expect(groups[0].defaultRate).toBe(22.5);
      expect(groups[0].defaultSalary).toBe(500);
    });
  });

  it("changing the currency display symbol never touches stored numeric values", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "prompt").mockReturnValue("Currency Group");

    render(<App />);
    await screen.findByText("აირჩიე ჯგუფი ▾");
    await openGroupMenu();
    await user.click(screen.getByRole("button", { name: "+ ჯგუფი" }));
    await screen.findByRole("button", { name: "+ ახალი პერიოდი" });
    await user.click(screen.getByRole("button", { name: "+ ახალი პერიოდი" }));
    await screen.findByRole("button", { name: "+ კლიენტი" });
    await user.click(screen.getByRole("button", { name: "+ კლიენტი" }));

    const table = screen.getByRole("table");
    await user.type(within(table).getAllByPlaceholderText("0")[0], "1234.56");

    await openSettings(user);
    const currencySelect = screen.getByLabelText("სავალუტო სიმბოლო");
    await user.selectOptions(currencySelect, "$");

    await waitFor(async () => {
      const stored = await db.settings.get("app");
      expect(stored?.currencySymbol).toBe("$");
    });

    // The Overview KPI should now show the new symbol as a prefix.
    await user.click(screen.getByRole("tab", { name: "რედაქტირება" }));
    await waitFor(() => {
      expect(screen.getByText("$1234.56")).toBeInTheDocument();
    });

    // The underlying stored Gross value must be completely unchanged.
    const rows = await db.clientRows.toArray();
    expect(rows[0].gross).toBe("1234.56");
  });

  it("skips the confirmation dialog for destructive actions when the setting is turned off", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "prompt").mockReturnValue("Group To Delete");
    const confirmSpy = vi.spyOn(window, "confirm");

    render(<App />);
    await screen.findByText("აირჩიე ჯგუფი ▾");
    await openGroupMenu();
    await user.click(screen.getByRole("button", { name: "+ ჯგუფი" }));
    await screen.findByRole("button", { name: /Group To Delete/ });

    await openSettings(user);
    await user.click(screen.getByLabelText(/დაადასტურე წაშლის მოქმედებები/));

    await user.click(screen.getByRole("tab", { name: "რედაქტირება" }));
    await user.click(screen.getByRole("button", { name: "წაშლა" }));

    expect(confirmSpy).not.toHaveBeenCalled();
    await waitFor(async () => {
      expect(await db.groups.count()).toBe(0);
    });
  });

  it("still confirms destructive actions by default (setting left on)", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "prompt").mockReturnValue("Group Kept");
    vi.spyOn(window, "confirm").mockReturnValue(false); // decline

    render(<App />);
    await screen.findByText("აირჩიე ჯგუფი ▾");
    await openGroupMenu();
    await user.click(screen.getByRole("button", { name: "+ ჯგუფი" }));
    await screen.findByRole("button", { name: /Group Kept/ });

    await user.click(screen.getByRole("button", { name: "წაშლა" }));

    expect(window.confirm).toHaveBeenCalled();
    expect(await db.groups.count()).toBe(1); // declined -> still there
  });

  it("requires typing the exact confirmation phrase before 'clear all data' is enabled", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "prompt").mockReturnValue("Group X");

    render(<App />);
    await screen.findByText("აირჩიე ჯგუფი ▾");
    await openGroupMenu();
    await user.click(screen.getByRole("button", { name: "+ ჯგუფი" }));
    await screen.findByRole("button", { name: /Group X/ });

    await openSettings(user);
    const clearBtn = screen.getByRole("button", { name: "წაშალე ყველა მონაცემი" });
    expect(clearBtn).toBeDisabled();

    const confirmInput = screen.getByPlaceholderText("წაშალე");
    await user.type(confirmInput, "wrong phrase");
    expect(clearBtn).toBeDisabled();

    await user.clear(confirmInput);
    await user.type(confirmInput, "წაშალე");
    expect(clearBtn).toBeEnabled();

    await user.click(clearBtn);

    await waitFor(async () => {
      expect(await db.groups.count()).toBe(0);
    });
    expect(screen.getByText("ყველა მონაცემი წაიშალა.")).toBeInTheDocument();
  });
});
