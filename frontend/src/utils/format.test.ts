import { describe, expect, it } from "vitest";

import { formatDailyCost } from "./format";

describe("formatDailyCost", () => {
  it("renders negative net costs as explicitly positive profits", () => {
    expect(formatDailyCost(-12.34)).toBe("+¥12.3/天");
    expect(formatDailyCost(-100)).toBe("+¥100/天");
  });

  it("preserves ordinary costs, zero and unavailable values", () => {
    expect(formatDailyCost(12.34)).toBe("¥12.3/天");
    expect(formatDailyCost(0)).toBe("¥0.0/天");
    expect(formatDailyCost(null)).toBe("未计算");
    expect(formatDailyCost(Number.NaN)).toBe("未计算");
  });
});
