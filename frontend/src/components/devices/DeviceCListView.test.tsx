import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

import { DeviceCListView } from "./DeviceCListView";
import type { DeviceListItem } from "../../types/device";

const items: DeviceListItem[] = [
  {
    id: 1,
    name: "A7M3",
    brand: "Sony",
    category: "camera_body",
    mount_system_key: "fe",
    mount_system_custom: null,
    mount_system_label: "FE",
    status: "sold",
    score: 88,
    rating_label: "excellent",
    acquisition_iteration: 1,
    tags: ["CList", "CList-2020"],
    purchase_price: 10000,
    sale_price: 8000,
    daily_cost_value: 3.5,
    purchase_date: "2020-01-01",
    sale_date: "2021-01-01",
    image_source_type: null,
    image_original_url: null,
    image_storage_path: null,
    image_storage_name: null,
    image_url: null,
    created_at: "2026-01-01T00:00:00",
    updated_at: "2026-01-01T00:00:00"
  },
  {
    id: 2,
    name: "X-T5",
    brand: "Fujifilm",
    category: "camera_body",
    mount_system_key: "x",
    mount_system_custom: null,
    mount_system_label: "X",
    status: "holding",
    score: -1,
    rating_label: null,
    acquisition_iteration: 2,
    tags: ["CList", "CList-2023"],
    purchase_price: 12000,
    sale_price: null,
    daily_cost_value: null,
    purchase_date: "2023-10-01",
    sale_date: null,
    image_source_type: null,
    image_original_url: null,
    image_storage_path: null,
    image_storage_name: null,
    image_url: null,
    created_at: "2026-01-01T00:00:00",
    updated_at: "2026-01-01T00:00:00"
  }
];

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

describe("DeviceCListView", () => {
  it("renders the CList timeline groups and opens detail routes", () => {
    render(
      <MemoryRouter initialEntries={["/clist"]}>
        <Routes>
          <Route
            path="/clist/*"
            element={
              <>
                <DeviceCListView items={items} detailBasePath="/clist/devices" />
                <LocationProbe />
              </>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText("CList Map")).toBeInTheDocument();
    expect(screen.getByText("2020")).toBeInTheDocument();
    expect(screen.getByText("2023")).toBeInTheDocument();
    expect(screen.getByText("A7M3")).toBeInTheDocument();
    expect(screen.getByText(/X-T5/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /X-T5/ }));

    expect(screen.getByTestId("location")).toHaveTextContent("/clist/devices/2");
  });

  it("zooms with the wheel and pans with left, right, or middle button", () => {
    render(
      <MemoryRouter>
        <DeviceCListView items={items} detailBasePath="/clist/devices" />
      </MemoryRouter>
    );

    const viewport = screen.getByTestId("clist-viewport");
    const canvas = screen.getByTestId("clist-canvas");
    expect(viewport).toHaveClass("bg-panelAlt");
    expect(canvas).toHaveClass("bg-panelAlt");
    viewport.getBoundingClientRect = () =>
      ({
        left: 0,
        top: 0,
        width: 800,
        height: 600,
        right: 800,
        bottom: 600,
        x: 0,
        y: 0,
        toJSON: () => ({})
      }) as DOMRect;

    fireEvent.wheel(viewport, { deltaY: -100, clientX: 200, clientY: 160 });
    expect(canvas.style.transform).toContain("scale(1.1)");

    for (const button of [0, 1, 2]) {
      fireEvent.pointerDown(viewport, { button, pointerId: button + 1, clientX: 100, clientY: 100 });
      fireEvent.pointerMove(viewport, { pointerId: button + 1, clientX: 130, clientY: 140 });
      fireEvent.pointerUp(viewport, { pointerId: button + 1, clientX: 130, clientY: 140 });
    }

    expect(canvas.style.transform).toContain("translate(");
  });
});
