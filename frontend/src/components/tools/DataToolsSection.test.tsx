import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DataToolsSection, parseImportPayload } from "./DataToolsSection";

const mocks = vi.hoisted(() => ({
  exportGGPack: vi.fn(),
  importGGPack: vi.fn(),
  previewGGPack: vi.fn(),
  refreshSummary: vi.fn(),
  resetAllData: vi.fn()
}));

vi.mock("../../api/data", () => ({
  exportGGPack: mocks.exportGGPack,
  importGGPack: mocks.importGGPack,
  previewGGPack: mocks.previewGGPack,
  resetAllData: mocks.resetAllData
}));

vi.mock("../layout/DashboardSummaryProvider", () => ({
  useDashboardSummary: () => ({
    refreshSummary: mocks.refreshSummary
  })
}));

function samplePackage() {
  return {
    format: "geargrade.ggpack.v1",
    schema_version: "geargrade.ggpack.v1",
    exported_at: "2026-04-22T00:00:00Z",
    counts: { devices: 1 },
    tables: [
      {
        name: "devices",
        columns: ["name", "brand", "category", "status", "score", "acquisition_iteration"],
        dedup_key: ["brand", "name", "acquisition_iteration", "purchase_date"],
        rows: [
          {
            name: "A",
            brand: "B",
            category: "camera_body",
            status: "holding",
            score: 80,
            acquisition_iteration: 1
          }
        ]
      }
    ]
  } as const;
}

describe("DataToolsSection", () => {
  it("renders second-level tabs", () => {
    render(<DataToolsSection />);

    expect(screen.getByRole("button", { name: "主库" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "心愿池" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "重置" })).toBeInTheDocument();
  });

  it("previews GGPack rows before import", async () => {
    mocks.previewGGPack.mockResolvedValueOnce({
      format: "geargrade.ggpack.v1",
      mode: "update",
      tables: [
        {
          name: "devices",
          total: 1,
          valid: 1,
          create: 0,
          update: 1,
          skipped: 0,
          errors: [],
          rows: [{ index: 0, name: "A", action: "update", selected: true, reason: null }]
        }
      ]
    });

    render(<DataToolsSection />);

    const input = screen.getByText("选择文件").closest("label")?.querySelector("input");
    if (!input) {
      throw new Error("File input not rendered");
    }

    const file = new File([JSON.stringify(samplePackage())], "geargrade-devices.ggpack.json", {
      type: "application/json"
    });
    fireEvent.change(input, { target: { files: [file] } });

    expect(await screen.findByRole("button", { name: "导入选中 1 行" })).toBeInTheDocument();
    expect(screen.getByText("update")).toBeInTheDocument();
    expect(mocks.previewGGPack).toHaveBeenCalledWith(samplePackage());
  });

  it("imports selected rows and refreshes summary", async () => {
    mocks.previewGGPack.mockResolvedValueOnce({
      format: "geargrade.ggpack.v1",
      mode: "update",
      tables: [
        {
          name: "devices",
          total: 1,
          valid: 1,
          create: 0,
          update: 1,
          skipped: 0,
          errors: [],
          rows: [{ index: 0, name: "A", action: "update", selected: true, reason: null }]
        }
      ]
    });
    mocks.importGGPack.mockResolvedValueOnce({
      total: 1,
      created: 0,
      updated: 1,
      skipped: 0,
      errors: []
    });

    render(<DataToolsSection />);

    const input = screen.getByText("选择文件").closest("label")?.querySelector("input");
    if (!input) {
      throw new Error("File input not rendered");
    }

    fireEvent.change(input, {
      target: {
        files: [new File([JSON.stringify(samplePackage())], "geargrade-devices.ggpack.json")]
      }
    });
    fireEvent.click(await screen.findByRole("button", { name: "导入选中 1 行" }));

    await waitFor(() => {
      expect(mocks.importGGPack).toHaveBeenCalledWith({
        package: samplePackage(),
        mode: "update",
        selection: { devices: [0] }
      });
      expect(mocks.refreshSummary).toHaveBeenCalled();
    });
  });
});

describe("parseImportPayload", () => {
  it("accepts GGPack payload", () => {
    expect(parseImportPayload(JSON.stringify(samplePackage()))).toEqual(samplePackage());
  });

  it("rejects legacy wrapped payload", () => {
    expect(() => parseImportPayload(JSON.stringify({ items: [{ name: "A" }] }))).toThrow("GGPack JSON");
  });
});
