import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import DataToolsPage from "./DataToolsPage";

vi.mock("../components/tools/DataToolsSection",()=>({
  DataToolsSection:()=> <div data-testid="ggpack-tools">GGPack 数据工具</div>
}));
vi.mock("../components/photo-data/PhotoDatabaseMaintenance",()=>({
  PhotoDatabaseMaintenance:({mode}:{mode:string})=>
    <section aria-label="照片索引数据库维护" data-testid="photo-maintenance">照片索引数据库 / {mode}</section>
}));
describe("DataToolsPage",()=>{
  it("hosts photo index maintenance independently of photography analytics",()=>{
    const {container}=render(<DataToolsPage/>);
    expect(screen.getByRole("heading",{name:"数据工具"})).toBeInTheDocument();
    expect(screen.getByLabelText("照片索引数据库维护")).toHaveTextContent("manage");
    expect(screen.getByTestId("ggpack-tools")).toBeInTheDocument();
    expect(container.querySelectorAll('[data-testid="photo-maintenance"]').length).toBe(1);
  });
});
