import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CategoryIconFallback } from "./CategoryIcon";

describe("CategoryIconFallback", () => {
  it("renders the drone default icon", () => {
    render(<CategoryIconFallback category="drone" />);

    expect(screen.getByRole("img", { name: "无人机默认图标" })).toBeInTheDocument();
  });
});
