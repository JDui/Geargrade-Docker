import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DataToolsSection } from "./DataToolsSection";

const mocks = vi.hoisted(() => ({
  refreshSummary: vi.fn()
}));

vi.mock("../layout/DashboardSummaryProvider", () => ({
  useDashboardSummary: () => ({
    refreshSummary: mocks.refreshSummary
  })
}));

describe("DataToolsSection", () => {
  it("uses button styling for import file picker", () => {
    render(<DataToolsSection />);

    const trigger = screen.getByText("选择文件").closest("label");
    const fileInput = trigger?.querySelector('input[type="file"]');

    if (!trigger || !fileInput) {
      throw new Error("Import file picker not rendered");
    }

    expect(trigger).toHaveClass("button-secondary");
    expect(fileInput).toHaveClass("sr-only");
  });
});
