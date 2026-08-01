import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, cleanup, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../../App";
import { resetAppForTest, openGroupMenu } from "../../test/resetAppForTest";

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
    vi.spyOn(window, "prompt").mockReturnValue("Overview Group");

    render(<App />);
    await screen.findByText("აირჩიე ჯგუფი ▾");

    await openGroupMenu();
    await user.click(screen.getByRole("button", { name: "+ ჯგუფი" }));
    await user.click(screen.getByRole("button", { name: "+ ახალი პერიოდი" }));
    await user.click(screen.getByRole("button", { name: "+ კლიენტი" }));

    const overviewCard = screen.getByText("📊 Overview").closest("section")!;

    // Initially everything is zero.
    expect(within(overviewCard).getAllByText(/0\.00/).length).toBeGreaterThan(0);

    const table = screen.getByRole("table");
    const grossInput = within(table).getAllByPlaceholderText("0")[0];
    await user.type(grossInput, "1000");

    // Default group rate is 13.5%, Net not entered -> Gross is the My€ base,
    // and the same row is "Unpaid" (Gross entered, Net not entered).
    await waitFor(() => {
      const grossKpi = within(overviewCard).getByText("Gross").parentElement!;
      expect(grossKpi).toHaveTextContent("1000.00");
    });

    await waitFor(() => {
      const unpaidPill = within(overviewCard).getByText("Unpaid").parentElement!;
      expect(unpaidPill).toHaveTextContent("135.00"); // 1000 * 13.5%
    });

    // No salary configured for this group (default 0) -> income == unpaid.
    await waitFor(() => {
      const incomePill = within(overviewCard).getByText("Income").parentElement!;
      expect(incomePill).toHaveTextContent("135.00");
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
    vi.spyOn(window, "prompt").mockReturnValue("Salary Group");

    render(<App />);
    await screen.findByText("აირჩიე ჯგუფი ▾");
    await openGroupMenu();
    await user.click(screen.getByRole("button", { name: "+ ჯგუფი" }));

    // Set a default salary of 400/28days -> 100/week.
    const salaryInput = screen.getByLabelText("Default salary / 28d");
    await user.clear(salaryInput);
    await user.type(salaryInput, "400");

    await user.click(screen.getByRole("button", { name: "+ ახალი პერიოდი" }));

    // A 1-week period with paidWeeks = 0 -> full week of salary owed.
    const fromInput = screen.getByLabelText("დან");
    const toInput = screen.getByLabelText("მდე");
    await user.type(fromInput, "2026-01-01");
    await user.type(toInput, "2026-01-07");

    await user.click(screen.getByRole("button", { name: "+ კლიენტი" }));
    const table = screen.getByRole("table");
    const grossInput = within(table).getAllByPlaceholderText("0")[0];
    await user.type(grossInput, "1000"); // unpaid = 1000 * 13.5% = 135

    const overviewCard = screen.getByText("📊 Overview").closest("section")!;

    await waitFor(() => {
      const unpaidPill = within(overviewCard).getByText("Unpaid").parentElement!;
      expect(unpaidPill).toHaveTextContent("135.00");
    });

    // salary owed = 100 (1 week * 100/week, 0 paid weeks) -> income = 135 - 100 = 35
    await waitFor(() => {
      const incomePill = within(overviewCard).getByText("Income").parentElement!;
      expect(incomePill).toHaveTextContent("35.00");
    });
  });
});
