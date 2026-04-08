import { DEFAULT_FILTERS } from "../types/device";
import { buildDeviceQuery } from "./devices";

describe("buildDeviceQuery", () => {
  it("serializes active filters", () => {
    const query = buildDeviceQuery({
      ...DEFAULT_FILTERS,
      search: "Fujifilm",
      category: "camera_body",
      status: "holding",
      rating: "excellent",
      feelingOnly: true,
      purchaseYear: "2024",
      sortBy: "score",
      sortOrder: "asc"
    });

    expect(query).toContain("search=Fujifilm");
    expect(query).toContain("category=camera_body");
    expect(query).toContain("status=holding");
    expect(query).toContain("rating_label=excellent");
    expect(query).toContain("feeling_only=true");
    expect(query).toContain("purchase_year=2024");
    expect(query).toContain("sort_by=score");
    expect(query).toContain("sort_order=asc");
  });
});
