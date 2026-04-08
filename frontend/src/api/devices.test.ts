import { DEFAULT_FILTERS } from "../types/device";
import { buildDeviceQuery } from "./devices";

describe("buildDeviceQuery", () => {
  it("serializes active filters", () => {
    const query = buildDeviceQuery({
      ...DEFAULT_FILTERS,
      search: "Fujifilm",
      category: "camera_body",
      status: "holding",
      rating: "god",
      sortBy: "purchase_price",
      sortOrder: "asc"
    });

    expect(query).toContain("search=Fujifilm");
    expect(query).toContain("category=camera_body");
    expect(query).toContain("status=holding");
    expect(query).toContain("rating=god");
    expect(query).toContain("sort_by=purchase_price");
    expect(query).toContain("sort_order=asc");
  });
});
