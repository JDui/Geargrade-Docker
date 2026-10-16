import "@testing-library/jest-dom";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchAppSettings, updateAppSettings, type AppSettingsApi } from "../../api/settings";
import { AppSettingsProvider, useAppSettings } from "./AppSettingsProvider";

vi.mock("../../api/settings", () => ({ fetchAppSettings: vi.fn(), updateAppSettings: vi.fn() }));

const remote: AppSettingsApi = {
  simplified_mode: true, motion_mode: "system", content_width: "wide",
  density: "comfortable", show_background_grid: true, default_icon_size: "small"
};

function SettingsConsumer() {
  const { contentWidth, setContentWidth } = useAppSettings();
  return <><span>{contentWidth}</span><button onClick={() => setContentWidth("compact")}>更改布局</button></>;
}

function openPage() {
  render(<AppSettingsProvider><SettingsConsumer /></AppSettingsProvider>);
}

describe("AppSettingsProvider read-only loading", () => {
  beforeEach(() => {
    window.localStorage.clear();
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })
    });
    vi.mocked(fetchAppSettings).mockReset().mockResolvedValue(remote);
    vi.mocked(updateAppSettings).mockReset().mockResolvedValue(remote);
  });
  afterEach(() => window.localStorage.clear());

  it("loads remote settings without submitting them back to the server", async () => {
    openPage();
    await act(async () => {});
    expect(screen.getByText("wide")).toBeInTheDocument();
    expect(updateAppSettings).not.toHaveBeenCalled();
  });

  it("does not upload cached preferences just because a page opens", async () => {
    window.localStorage.setItem("geargrade-app-settings-v1", JSON.stringify({contentWidth:"compact"}));
    openPage();
    await act(async () => {});
    expect(screen.getByText("compact")).toBeInTheDocument();
    expect(updateAppSettings).not.toHaveBeenCalled();
  });

  it("still saves an intentional edit after loading", async () => {
    openPage();
    await screen.findByText("wide");
    fireEvent.click(screen.getByRole("button", { name: "更改布局" }));
    await waitFor(() => expect(updateAppSettings).toHaveBeenCalledWith({...remote, content_width:"compact"}));
    expect(updateAppSettings).toHaveBeenCalledTimes(1);
  });

  it("preserves and saves an intentional edit made before loading completes", async () => {
    let finish!: (value: AppSettingsApi) => void;
    vi.mocked(fetchAppSettings).mockReturnValue(new Promise(resolve => { finish = resolve; }));
    openPage();
    fireEvent.click(screen.getByRole("button", { name: "更改布局" }));
    await act(async () => finish(remote));
    await waitFor(() => expect(updateAppSettings).toHaveBeenCalledWith({...remote, content_width:"compact"}));
    expect(screen.getByText("compact")).toBeInTheDocument();
    expect(updateAppSettings).toHaveBeenCalledTimes(1);
  });
});
