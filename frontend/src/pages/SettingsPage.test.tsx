import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AppSettingsProvider } from "../components/layout/AppSettingsProvider";
import SettingsPage from "./SettingsPage";

function renderSettingsPage() {
  render(
    <AppSettingsProvider>
      <SettingsPage />
    </AppSettingsProvider>
  );
}

describe("SettingsPage", () => {
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
    window.localStorage.clear();
    vi.restoreAllMocks();
    document.documentElement.removeAttribute("data-motion");
    document.documentElement.removeAttribute("data-effective-motion");
    document.documentElement.removeAttribute("data-content-width");
    document.documentElement.removeAttribute("data-density");
    document.documentElement.removeAttribute("data-background-grid");
    document.documentElement.removeAttribute("data-default-icon-size");
  });

  it("enables simplified mode and default display controls by default", () => {
    renderSettingsPage();

    expect(screen.getByRole("checkbox", { name: /已开启/ })).toBeChecked();
    expect(screen.getByRole("button", { name: "自动" })).toHaveClass("button-primary");
    expect(screen.getByRole("button", { name: "默认" })).toHaveClass("button-primary");
    expect(screen.getByRole("button", { name: "舒适" })).toHaveClass("button-primary");
    expect(screen.getByRole("button", { name: "小" })).toHaveClass("button-primary");

    expect(window.localStorage.getItem("geargrade-simplified-mode")).toBe("true");
    expect(JSON.parse(window.localStorage.getItem("geargrade-app-settings-v1") ?? "{}")).toMatchObject({
      simplifiedMode: true,
      motionMode: "system",
      contentWidth: "default",
      density: "comfortable",
      showBackgroundGrid: true,
      defaultIconSize: "small"
    });
  });

  it("reads the legacy simplified mode key", () => {
    window.localStorage.setItem("geargrade-simplified-mode", "false");

    renderSettingsPage();

    expect(screen.getByRole("checkbox", { name: /已关闭/ })).not.toBeChecked();
  });

  it("stores changes and updates root dataset", () => {
    renderSettingsPage();

    fireEvent.click(screen.getByRole("button", { name: "减少" }));
    fireEvent.click(screen.getByRole("button", { name: "宽屏" }));
    fireEvent.click(screen.getAllByRole("button", { name: "紧凑" })[1]);
    fireEvent.click(screen.getByRole("button", { name: "中" }));
    fireEvent.click(screen.getAllByRole("checkbox")[1]);

    expect(document.documentElement.dataset.motion).toBe("reduced");
    expect(document.documentElement.dataset.effectiveMotion).toBe("reduced");
    expect(document.documentElement.dataset.contentWidth).toBe("wide");
    expect(document.documentElement.dataset.density).toBe("compact");
    expect(document.documentElement.dataset.backgroundGrid).toBe("off");
    expect(document.documentElement.dataset.defaultIconSize).toBe("medium");
    expect(JSON.parse(window.localStorage.getItem("geargrade-app-settings-v1") ?? "{}")).toMatchObject({
      motionMode: "reduced",
      contentWidth: "wide",
      density: "compact",
      showBackgroundGrid: false,
      defaultIconSize: "medium"
    });
  });
});
