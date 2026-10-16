import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DailyCostValue } from "./DailyCostValue";

describe("DailyCostValue", () => {
  it("shows profits as a positive daily return with the profit tone", () => {
    render(<DailyCostValue value={-12.34} />);
    expect(screen.getByText("+¥12.3/天")).toHaveClass("daily-cost-profit");
  });

  it("keeps losses and holding costs visually neutral", () => {
    const { rerender } = render(<DailyCostValue value={12.34} />);
    expect(screen.getByText("¥12.3/天")).not.toHaveClass("daily-cost-profit");
    rerender(<DailyCostValue value={0} />);
    expect(screen.getByText("¥0.0/天")).not.toHaveClass("daily-cost-profit");
    rerender(<DailyCostValue value={null} />);
    expect(screen.getByText("未计算")).not.toHaveClass("daily-cost-profit");
  });
});
