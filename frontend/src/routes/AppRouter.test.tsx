import "@testing-library/jest-dom";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

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

describe("AppRouter", () => {
  beforeAll(() => {
    // @ts-expect-error test stub
    global.ResizeObserver = ResizeObserverMock;
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
              ratings: [
                { key: "god", count: 1 },
                { key: "excellent", count: 0 },
                { key: "average", count: 0 },
                { key: "low", count: 0 },
                { key: "special", count: 0 }
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
              mount_system: "X Mount",
              status: "holding",
              rating: "god",
              summary: "测试摘要",
              tags: ["旗舰"],
              purchase_price: 12500,
              sale_price: null,
              purchase_date: "2023-10-01",
              sale_date: null,
              is_currently_owned: true,
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
      <MemoryRouter initialEntries={["/devices/42"]}>
        <AppRouter />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("设备详情")).toBeInTheDocument();
    });
  });
});
