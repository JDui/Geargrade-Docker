import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";

import { DeviceForm } from "./DeviceForm";

describe("DeviceForm", () => {
  it("submits the normalized payload", async () => {
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
    fireEvent.change(screen.getByLabelText("一句话总结"), { target: { value: "经典旁轴体验。" } });
    fireEvent.click(screen.getByRole("button", { name: "创建设备" }));

    expect(onSubmit).toHaveBeenCalled();
  });
});
