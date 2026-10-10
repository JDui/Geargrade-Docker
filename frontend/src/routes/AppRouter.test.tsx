import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";

import { AppSettingsProvider } from "../components/layout/AppSettingsProvider";
import { DashboardSummaryProvider } from "../components/layout/DashboardSummaryProvider";
import { ThemeProvider } from "../components/layout/ThemeProvider";
import { AppRouter } from "./AppRouter";

class ResizeObserverMock {
  observe() {
    return undefined;
  }

  unobserve() {
    return undefined;
  }

  disconnect() {
    return undefined;
  }
}

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname + location.search}</output>;
}

describe("AppRouter", () => {
  beforeAll(() => {
    vi.stubGlobal("scrollTo", vi.fn());
    Object.defineProperty(globalThis, "ResizeObserver", {
      value: ResizeObserverMock,
      configurable: true
    });
    Object.defineProperty(window, "matchMedia", {
      value: vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      })),
      configurable: true
    });
  });

  it("opens the detail drawer on device route", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/dashboard/summary")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              currently_owned_count: 1,
              sold_count: 0,
              feeling_in_progress_count: 0,
              ratings: [
                { key: "god", count: 1 },
                { key: "excellent", count: 0 },
                { key: "average", count: 0 },
                { key: "low", count: 0 }
              ],
              purchase_years: [{ year: 2023, count: 1 }],
              purchase_year_category_breakdown: [
                {
                  year: 2023,
                  buckets: [
                    { key: "camera_body", count: 1 },
                    { key: "lens", count: 0 },
                    { key: "action_camera", count: 0 },
                    { key: "drone", count: 0 },
                    { key: "other", count: 0 }
                  ]
                }
              ],
              purchase_year_rating_breakdown: [
                {
                  year: 2023,
                  buckets: [
                    { key: "god", count: 1 },
                    { key: "excellent", count: 0 },
                    { key: "average", count: 0 },
                    { key: "low", count: 0 }
                  ]
                }
              ],
              categories: [
                { key: "camera_body", count: 1 },
                { key: "lens", count: 0 },
                { key: "action_camera", count: 0 },
                { key: "drone", count: 0 },
                { key: "accessory", count: 0 },
                { key: "other", count: 0 }
              ]
            })
          )
        );
      }
      if (url.includes("/devices/42")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              id: 42,
              name: "Fujifilm X-T5",
              brand: "Fujifilm",
              category: "camera_body",
              mount_system_key: "x",
              mount_system_custom: null,
              mount_system_label: "X",
              status: "holding",
              score: 103,
              rating_label: "god",
              score_rank: 1,
              acquisition_iteration: 1,
              tags: ["旗舰"],
              purchase_price: 12500,
              sale_price: null,
              purchase_date: "2023-10-01",
              sale_date: null,
              image_source_type: null,
              image_original_url: null,
              image_storage_path: null,
              image_storage_name: null,
              image_url: null,
              created_at: "2025-01-01T00:00:00",
              updated_at: "2025-01-01T00:00:00",
              pros: [],
              cons: [],
              review_detail: ""
            })
          )
        );
      }
      return Promise.resolve(new Response(JSON.stringify({ items: [], total: 0 })));
    });

    vi.stubGlobal("fetch", fetchMock);

    render(
      <ThemeProvider>
        <AppSettingsProvider>
          <DashboardSummaryProvider>
            <MemoryRouter initialEntries={["/devices/42"]}>
              <AppRouter />
            </MemoryRouter>
          </DashboardSummaryProvider>
        </AppSettingsProvider>
      </ThemeProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("设备详情")).toBeInTheDocument();
    });
  });

  it("opens the detail drawer when a CList node icon is clicked", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/dashboard/summary")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              currently_owned_count: 1,
              sold_count: 0,
              feeling_in_progress_count: 0,
              ratings: [],
              purchase_years: [{ year: 2023, count: 1 }],
              purchase_year_category_breakdown: [],
              purchase_year_rating_breakdown: [],
              categories: []
            })
          )
        );
      }
      if (url.includes("/devices/42")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              id: 42,
              name: "Fujifilm X-T5",
              brand: "Fujifilm",
              category: "camera_body",
              mount_system_key: "x",
              mount_system_custom: null,
              mount_system_label: "X",
              status: "holding",
              score: 103,
              rating_label: "god",
              score_rank: 1,
              acquisition_iteration: 1,
              tags: ["CList"],
              purchase_price: 12500,
              sale_price: null,
              daily_cost_value: null,
              purchase_date: "2023-10-01",
              sale_date: null,
              image_source_type: null,
              image_original_url: null,
              image_storage_path: null,
              image_storage_name: null,
              image_url: null,
              created_at: "2025-01-01T00:00:00",
              updated_at: "2025-01-01T00:00:00",
              pros: [],
              cons: [],
              review_detail: ""
            })
          )
        );
      }
      return Promise.resolve(
        new Response(
          JSON.stringify({
            items: [
              {
                id: 42,
                name: "Fujifilm X-T5",
                brand: "Fujifilm",
                category: "camera_body",
                mount_system_key: "x",
                mount_system_custom: null,
                mount_system_label: "X",
                status: "holding",
                score: 103,
                rating_label: "god",
                acquisition_iteration: 1,
                tags: ["CList"],
                purchase_price: 12500,
                sale_price: null,
                daily_cost_value: null,
                purchase_date: "2023-10-01",
                sale_date: null,
                image_source_type: null,
                image_original_url: null,
                image_storage_path: null,
                image_storage_name: null,
                image_url: null,
                created_at: "2025-01-01T00:00:00",
                updated_at: "2025-01-01T00:00:00"
              }
            ],
            total: 1
          })
        )
      );
    });

    vi.stubGlobal("fetch", fetchMock);

    render(
      <ThemeProvider>
        <AppSettingsProvider>
          <DashboardSummaryProvider>
            <MemoryRouter initialEntries={["/clist"]}>
              <AppRouter />
            </MemoryRouter>
          </DashboardSummaryProvider>
        </AppSettingsProvider>
      </ThemeProvider>
    );

    fireEvent.click(await screen.findByTestId("clist-device-icon-holding-42"));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/v1/devices/42", expect.anything());
      expect(document.querySelector(".drawer-panel")).toBeInTheDocument();
    });
  });

  it("renders data tools page at /data-tools", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              currently_owned_count: 0,
              sold_count: 0,
              feeling_in_progress_count: 0,
              ratings: [],
              purchase_years: [],
              purchase_year_category_breakdown: [],
              purchase_year_rating_breakdown: [],
              categories: []
            })
          )
        )
      )
    );

    render(
      <ThemeProvider>
        <AppSettingsProvider>
          <DashboardSummaryProvider>
            <MemoryRouter initialEntries={["/data-tools"]}>
              <AppRouter />
            </MemoryRouter>
          </DashboardSummaryProvider>
        </AppSettingsProvider>
      </ThemeProvider>
    );

    expect(await screen.findByRole("button", { name: "主库" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "心愿池" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "重置" })).toBeInTheDocument();
  });

  it("opens feeling devices from either summary and preserves filters through details", async () => {
    const device = {
      id: 42, name: "Feeling camera", brand: "Sony", category: "camera_body", status: "sold",
      score: -1, rating_label: null, score_rank: null, acquisition_iteration: 1, tags: [],
      mount_system_key: "e", mount_system_label: "E", mount_system_custom: null,
      purchase_price: 2000, sale_price: 1800, daily_cost_value: 1,
      purchase_date: "2025-01-01", sale_date: "2025-06-01", image_url: null,
      created_at: "2025-01-01T00:00:00", updated_at: "2025-06-01T00:00:00",
      pros: [], cons: [], review_detail: ""
    };
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      const value = url.includes("/dashboard/summary") ? {
        currently_owned_count: 0, sold_count: 1, feeling_in_progress_count: 1,
        ratings: [], categories: [], purchase_years: [],
        purchase_year_category_breakdown: [], purchase_year_rating_breakdown: []
      } : url.includes("/devices/42") ? device : { items: [device], total: 1 };
      return Promise.resolve(new Response(JSON.stringify(value)));
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<ThemeProvider><AppSettingsProvider><DashboardSummaryProvider>
      <MemoryRouter initialEntries={["/"]}><AppRouter/><LocationProbe/></MemoryRouter>
    </DashboardSummaryProvider></AppSettingsProvider></ThemeProvider>);
    expect(await screen.findByRole("link", { name: "查看正在感受设备：1" })).toHaveAttribute("href", "/archive?feeling_only=true");
    fireEvent.click(screen.getByRole("link", { name: "查看正在感受设备", exact: true }));
    await screen.findByRole("heading", { name: "正在感受 · 1 条设备档案" });
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("feeling_only=true"))).toBe(true);
    fireEvent.click(await screen.findByRole("button", { name: /Feeling camera/ }));
    await screen.findByText("设备详情");
    expect(screen.getByTestId("location")).toHaveTextContent("/archive/devices/42?feeling_only=true");
    fireEvent.click(screen.getByRole("button", { name: "关闭", exact: true }));
    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("/archive?feeling_only=true"));
    expect(screen.getByRole("heading", { name: "正在感受 · 1 条设备档案" })).toBeInTheDocument();
    const search=screen.getAllByRole("textbox")[0];
    fireEvent.change(search,{target:{value:"Sony "}});
    expect(search).toHaveValue("Sony ");
    fireEvent.change(search,{target:{value:"Sony camera"}});
    expect(search).toHaveValue("Sony camera");
    await waitFor(()=>expect(fetchMock.mock.calls.some(([url])=>String(url).includes("search=Sony+camera"))).toBe(true));
  });
});
