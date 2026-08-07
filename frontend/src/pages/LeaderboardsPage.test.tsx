import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AppSettingsProvider } from "../components/layout/AppSettingsProvider";
import LeaderboardsPage from "./LeaderboardsPage";

const mocks = vi.hoisted(() => ({
  fetchScoreLeaderboard: vi.fn(),
  fetchHoldingDurationLeaderboard: vi.fn(),
  fetchFinanceLeaderboard: vi.fn()
}));

vi.mock("../api/leaderboards", () => ({
  fetchFinanceLeaderboard: mocks.fetchFinanceLeaderboard,
  fetchHoldingDurationLeaderboard: mocks.fetchHoldingDurationLeaderboard,
  fetchScoreLeaderboard: mocks.fetchScoreLeaderboard
}));

describe("LeaderboardsPage", () => {
  beforeEach(() => {
    Object.defineProperty(window, "matchMedia", {
      value: vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      })),
      configurable: true
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it("keeps top1 first on narrow layout", async () => {
    mocks.fetchScoreLeaderboard.mockResolvedValue({
      items: [
        {
          rank: 1,
          device_id: 101,
          name: "Alpha",
          brand: "Brand A",
          score: 300,
          rating_label: "god",
          daily_cost_value: 12.3
        },
        {
          rank: 2,
          device_id: 102,
          name: "Beta",
          brand: "Brand B",
          score: 250,
          rating_label: "excellent",
          daily_cost_value: 10.2
        },
        {
          rank: 3,
          device_id: 103,
          name: "Gamma",
          brand: "Brand C",
          score: 200,
          rating_label: "average",
          daily_cost_value: 8.1
        }
      ]
    });

    render(
      <MemoryRouter initialEntries={["/leaderboards?tab=score&sort_order=desc"]}>
        <AppSettingsProvider>
          <LeaderboardsPage />
        </AppSettingsProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(mocks.fetchScoreLeaderboard).toHaveBeenCalledWith("desc", "");
    });

    await screen.findByText("TOP #1");

    const top1Card = screen.getByText("TOP #1").closest("button");
    const top2Card = screen.getByText("TOP #2").closest("button");
    const top3Card = screen.getByText("TOP #3").closest("button");

    expect(top1Card).toHaveClass("order-1", "lg:order-2");
    expect(top2Card).toHaveClass("order-2", "lg:order-1");
    expect(top3Card).toHaveClass("order-3", "lg:order-3");
  });

  it("filters leaderboard by category via the category pills", async () => {
    mocks.fetchScoreLeaderboard.mockResolvedValue({ items: [] });

    render(
      <MemoryRouter initialEntries={["/leaderboards?tab=score&sort_order=desc"]}>
        <AppSettingsProvider>
          <LeaderboardsPage />
        </AppSettingsProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(mocks.fetchScoreLeaderboard).toHaveBeenCalledWith("desc", "");
    });

    fireEvent.click(screen.getByRole("button", { name: "镜头" }));

    await waitFor(() => {
      expect(mocks.fetchScoreLeaderboard).toHaveBeenCalledWith("desc", "lens");
    });

    expect(screen.getByRole("button", { name: "镜头" }).className).toContain("button-primary");
  });

  it("uses month durations in simplified mode", async () => {
    mocks.fetchHoldingDurationLeaderboard.mockResolvedValue({
      items: [
        {
          rank: 1,
          device_id: 201,
          name: "Long Hold",
          brand: "Brand C",
          score: 80,
          rating_label: "excellent",
          daily_cost_value: 2,
          duration_days: 75,
          duration_months: 2,
          purchase_date: "2024-01-01",
          sale_date: "2024-03-01"
        }
      ]
    });

    render(
      <MemoryRouter initialEntries={["/leaderboards?tab=holding-duration&sort_order=desc"]}>
        <AppSettingsProvider>
          <LeaderboardsPage />
        </AppSettingsProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(mocks.fetchHoldingDurationLeaderboard).toHaveBeenCalledWith("desc", "months", "");
    });

    expect(await screen.findByText("2 个月")).toBeInTheDocument();
  });
});
