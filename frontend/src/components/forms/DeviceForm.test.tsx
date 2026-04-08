import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";

import { DeviceForm } from "./DeviceForm";

describe("DeviceForm", () => {
  it("submits feeling score and normalizes sale fields", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(
      <DeviceForm
        imageMode="none"
        remoteUrl=""
        onImageModeChange={() => undefined}
        onRemoteUrlChange={() => undefined}
        onUploadChange={() => undefined}
        onSubmit={onSubmit}
        submitting={false}
      />
    );

    fireEvent.change(screen.getByLabelText("名称"), { target: { value: "Fujifilm X-Pro3" } });
    fireEvent.change(screen.getByLabelText("品牌"), { target: { value: "Fujifilm" } });
    fireEvent.change(screen.getByLabelText("数字评分"), { target: { value: "-1" } });
    fireEvent.change(screen.getByLabelText("状态"), { target: { value: "for_sale" } });
    fireEvent.click(screen.getByRole("button", { name: "创建设备" }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ score: -1, sale_price: null, sale_date: null }));
  });
});
