import { describe, expect, it } from "vitest";
import { photoTimelineSeries } from "./photoData";

describe("photoTimelineSeries", () => {
  it("fills missing months across a year boundary without changing totals", () => {
    expect(photoTimelineSeries([{ key: "2025-02", count: 3 }, { key: "2024-12", count: 2 }], true)).toEqual([
      { key: "2024-12", count: 2 }, { key: "2025-01", count: 0 }, { key: "2025-02", count: 3 }
    ]);
  });

  it("retains empty years on the time axis", () => {
    expect(photoTimelineSeries([{ key: "2016", count: 4 }, { key: "2018", count: 430 }], false)).toEqual([
      { key: "2016", count: 4 }, { key: "2017", count: 0 }, { key: "2018", count: 430 }
    ]);
  });

  it("does not invent dates for missing or invalid entries", () => {
    expect(photoTimelineSeries([{ key: "2025-13", count: 10 }, { key: "", count: 5 }], true)).toEqual([]);
  });
});
