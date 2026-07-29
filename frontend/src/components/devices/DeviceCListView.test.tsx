import "@testing-library/jest-dom";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

import { DeviceCListView } from "./DeviceCListView";
import type { DeviceListItem, WishlistDeviceListItem } from "../../types/device";

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

const wishlistItems: WishlistDeviceListItem[] = [
  {
    id: 9,
    name: "GR IIIx",
    brand: "Ricoh",
    category: "camera_body",
    mount_system_key: null,
    mount_system_custom: null,
    mount_system_label: null,
    score: 90,
    rating_label: "excellent",
    acquisition_iteration: 1,
    tags: ["心愿池"],
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

function dispatchPointerMouseEvent(target: Element, type: string, init: MouseEventInit & { pointerId?: number; pointerType?: string }) {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, ...init });
  Object.defineProperties(event, {
    pointerId: { value: init.pointerId ?? 1 },
    pointerType: { value: init.pointerType ?? "mouse" }
  });

  act(() => {
    target.dispatchEvent(event);
  });
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
                <DeviceCListView items={items} wishlistItems={wishlistItems} detailBasePath="/clist/devices" />
                <LocationProbe />
              </>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText("CList Map")).toBeInTheDocument();
    expect(screen.getByText("持有设备")).toBeInTheDocument();
    expect(screen.getByText("2020")).toBeInTheDocument();
    expect(screen.getByText("2023")).toBeInTheDocument();
    const wishlistLabels = screen.getAllByText("心愿池");
    expect(wishlistLabels[0]).toBeInTheDocument();
    expect(screen.getByText("2023").compareDocumentPosition(wishlistLabels[0]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText("A7M3")).toBeInTheDocument();
    expect(screen.getAllByText(/X-T5/)).toHaveLength(2);
    expect(screen.getByTestId("clist-category-holding-camera_body")).toBeInTheDocument();
    expect(screen.getByTestId("clist-category-year-2020-camera_body")).toBeInTheDocument();
    expect(screen.getByTestId("clist-category-year-2023-camera_body")).toBeInTheDocument();
    expect(
      screen.getByTestId("clist-category-holding-camera_body").compareDocumentPosition(screen.getByTestId("clist-device-holding-2")) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(
      screen.getByTestId("clist-category-year-2023-camera_body").compareDocumentPosition(screen.getByTestId("clist-device-year-2023-2")) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();

    fireEvent.click(screen.getByTestId("clist-device-year-2023-2"));

    expect(screen.getByTestId("location")).toHaveTextContent("/clist/devices/2");
  });

  it("opens detail routes from node icons", () => {
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

    fireEvent.click(screen.getByTestId("clist-device-icon-year-2020-1"));

    expect(screen.getByTestId("location")).toHaveTextContent("/clist/devices/1");
  });

  it("pans from device cards and category labels while preserving click navigation", () => {
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

    const viewport = screen.getByTestId("clist-viewport");
    const canvas = screen.getByTestId("clist-canvas");
    const card = screen.getByTestId("clist-device-year-2023-2");

    dispatchPointerMouseEvent(card, "pointerdown", { button: 0, clientX: 100, clientY: 100 });
    dispatchPointerMouseEvent(card, "pointermove", { button: 0, clientX: 150, clientY: 150 });
    dispatchPointerMouseEvent(card, "pointerup", { button: 0, clientX: 150, clientY: 150 });

    expect(canvas.style.transform).toContain("translate(50px, 50px)");
    expect(screen.getByTestId("location")).toHaveTextContent("/clist");

    const category = screen.getByTestId("clist-category-year-2023-camera_body");
    dispatchPointerMouseEvent(category, "pointerdown", { button: 0, clientX: 150, clientY: 150 });
    dispatchPointerMouseEvent(category, "pointermove", { button: 0, clientX: 170, clientY: 180 });
    dispatchPointerMouseEvent(category, "pointerup", { button: 0, clientX: 170, clientY: 180 });

    expect(canvas.style.transform).toContain("translate(70px, 80px)");

    fireEvent.click(card);
    expect(screen.getByTestId("location")).toHaveTextContent("/clist");

    fireEvent.click(card);
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
    expect(viewport).toHaveClass("select-none");
    expect(canvas).toHaveClass("bg-panelAlt");
    expect(canvas).toHaveClass("select-none");
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

    const zoomInEvent = new WheelEvent("wheel", { bubbles: true, cancelable: true, deltaY: -100, clientX: 200, clientY: 160 });
    act(() => {
      viewport.dispatchEvent(zoomInEvent);
    });
    expect(zoomInEvent.defaultPrevented).toBe(true);
    expect(canvas.style.transform).toContain("scale(1.1)");

    for (let index = 0; index < 12; index += 1) {
      fireEvent.wheel(viewport, { deltaY: 100, clientX: 200, clientY: 160 });
    }
    expect(canvas.style.transform).toContain("scale(0.");
    expect(canvas.style.transform).not.toContain("scale(0.45)");

    for (const button of [0, 1, 2]) {
      fireEvent.pointerDown(viewport, { button, pointerId: button + 1, clientX: 100, clientY: 100 });
      fireEvent.pointerMove(viewport, { pointerId: button + 1, clientX: 130, clientY: 140 });
      fireEvent.pointerUp(viewport, { pointerId: button + 1, clientX: 130, clientY: 140 });
    }

    expect(canvas.style.transform).toContain("translate(");
  });

  it("pans from touchpad wheel gestures and zooms from touchpad pinch wheel gestures", () => {
    render(
      <MemoryRouter>
        <DeviceCListView items={items} detailBasePath="/clist/devices" />
      </MemoryRouter>
    );

    const viewport = screen.getByTestId("clist-viewport");
    const canvas = screen.getByTestId("clist-canvas");
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

    const panEvent = new WheelEvent("wheel", { bubbles: true, cancelable: true, deltaX: 20, deltaY: 40, clientX: 200, clientY: 160 });
    act(() => {
      viewport.dispatchEvent(panEvent);
    });

    expect(panEvent.defaultPrevented).toBe(true);
    expect(canvas.style.transform).toContain("translate(-20px, -40px)");
    expect(canvas.style.transform).toContain("scale(1)");

    const pinchEvent = new WheelEvent("wheel", { bubbles: true, cancelable: true, ctrlKey: true, deltaY: -40, clientX: 200, clientY: 160 });
    act(() => {
      viewport.dispatchEvent(pinchEvent);
    });

    expect(pinchEvent.defaultPrevented).toBe(true);
    expect(canvas.style.transform).toContain("scale(1.25)");
  });

  it("zooms with two touch pointers", () => {
    render(
      <MemoryRouter>
        <DeviceCListView items={items} detailBasePath="/clist/devices" />
      </MemoryRouter>
    );

    const viewport = screen.getByTestId("clist-viewport");
    const canvas = screen.getByTestId("clist-canvas");
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

    dispatchPointerMouseEvent(viewport, "pointerdown", { pointerId: 11, pointerType: "touch", button: 0, clientX: 100, clientY: 120 });
    dispatchPointerMouseEvent(viewport, "pointerdown", { pointerId: 12, pointerType: "touch", button: 0, clientX: 200, clientY: 120 });
    dispatchPointerMouseEvent(viewport, "pointermove", { pointerId: 12, pointerType: "touch", clientX: 300, clientY: 120 });
    dispatchPointerMouseEvent(viewport, "pointerup", { pointerId: 12, pointerType: "touch", clientX: 300, clientY: 120 });
    dispatchPointerMouseEvent(viewport, "pointerup", { pointerId: 11, pointerType: "touch", clientX: 100, clientY: 120 });

    expect(canvas.style.transform).toContain("scale(2)");
  });

  it("fits a large tree into the viewport", () => {
    const manyItems = Array.from({ length: 24 }, (_, index): DeviceListItem => ({
      ...items[0],
      id: index + 10,
      name: `Device ${index + 1}`,
      purchase_date: `${2020 + index}-01-01`
    }));

    render(
      <MemoryRouter>
        <DeviceCListView items={manyItems} detailBasePath="/clist/devices" />
      </MemoryRouter>
    );

    const viewport = screen.getByTestId("clist-viewport");
    const canvas = screen.getByTestId("clist-canvas");
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

    fireEvent.click(screen.getByRole("button", { name: "Fit" }));

    expect(canvas.style.transform).toContain("scale(0.");
  });
});
