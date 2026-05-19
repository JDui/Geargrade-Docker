import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

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

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ score: -1, sale_price: null, sale_date: null })
    );
  });

  it("accepts pasted image files in upload mode", () => {
    const onUploadChange = vi.fn();

    render(
      <DeviceForm
        imageMode="upload"
        remoteUrl=""
        onImageModeChange={() => undefined}
        onRemoteUrlChange={() => undefined}
        onUploadChange={onUploadChange}
        onSubmit={vi.fn().mockResolvedValue(undefined)}
        submitting={false}
      />
    );

    const pasteTarget = screen.getByRole("button", { name: /可直接粘贴图片/i });
    const file = new File(["image"], "clipboard.png", { type: "image/png" });
    const clipboardData = {
      items: [
        {
          type: "image/png",
          getAsFile: () => file
        }
      ]
    };

    fireEvent.paste(pasteTarget, { clipboardData });

    expect(onUploadChange).toHaveBeenCalledWith(expect.any(File));
  });

  it("converts month input to first day in simplified mode", async () => {
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
        simplifiedMode={true}
      />
    );

    fireEvent.change(screen.getByLabelText("名称"), { target: { value: "Sony A7C II" } });
    fireEvent.change(screen.getByLabelText("品牌"), { target: { value: "Sony" } });
    fireEvent.change(screen.getByLabelText("购入日期"), { target: { value: "2024-03" } });
    fireEvent.click(screen.getByRole("button", { name: "创建设备" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ purchase_date: "2024-03-01" }));
    });
  });
});
