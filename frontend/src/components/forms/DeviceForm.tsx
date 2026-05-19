import { useEffect, useState, type ClipboardEvent } from "react";
import { Controller, useForm } from "react-hook-form";

import type { DeviceDetail, DevicePayload, DeviceStatus, MountSystemKey } from "../../types/device";
import { CATEGORY_LABELS, MOUNT_SYSTEM_LABELS, STATUS_LABELS } from "../../types/device";
import { isFeelingScore, isUnratedScore, ratingLabelText, scoreToRatingLabel } from "../../utils/device";
import { StringListEditor } from "./StringListEditor";

export type ImageMode = "none" | "upload" | "remote";

export interface DeviceFormValues {
  name: string;
  brand: string;
  category: DevicePayload["category"];
  mount_system_key: MountSystemKey;
  mount_system_custom: string;
  status: DeviceStatus;
  score: string;
  is_first_purchase: boolean;
  acquisition_iteration_value: string;
  review_detail: string;
  tags: string[];
  pros: string[];
  cons: string[];
  purchase_price: string;
  sale_price: string;
  purchase_date: string;
  sale_date: string;
}

interface DeviceFormProps {
  defaultDevice?: DeviceDetail;
  imageMode: ImageMode;
  remoteUrl: string;
  onImageModeChange: (mode: ImageMode) => void;
  onRemoteUrlChange: (value: string) => void;
  onUploadChange: (file: File | null) => void;
  onSubmit: (payload: DevicePayload) => Promise<void>;
  submitting: boolean;
  submitLabel?: string;
  simplifiedMode?: boolean;
}

function toDateInputValue(value: string | null | undefined, simplifiedMode: boolean) {
  if (!value) {
    return "";
  }
  if (!simplifiedMode) {
    return value;
  }
  const match = value.match(/^(\d{4}-\d{2})/);
  return match ? match[1] : value;
}

function toPayloadDate(value: string, simplifiedMode: boolean) {
  if (!value) {
    return null;
  }
  return simplifiedMode && /^\d{4}-\d{2}$/.test(value) ? `${value}-01` : value;
}

function defaultValues(defaultDevice: DeviceDetail | undefined, simplifiedMode: boolean): DeviceFormValues {
  const iteration = defaultDevice?.acquisition_iteration ?? 1;
  return {
    name: defaultDevice?.name ?? "",
    brand: defaultDevice?.brand ?? "",
    category: defaultDevice?.category ?? "camera_body",
    mount_system_key: defaultDevice?.mount_system_key ?? "none",
    mount_system_custom: defaultDevice?.mount_system_custom ?? "",
    status: defaultDevice?.status ?? "holding",
    score: defaultDevice != null ? String(defaultDevice.score) : "-1",
    is_first_purchase: iteration === 1,
    acquisition_iteration_value: iteration > 1 ? String(iteration) : "2",
    review_detail: defaultDevice?.review_detail ?? "",
    tags: defaultDevice?.tags ?? [],
    pros: defaultDevice?.pros ?? [],
    cons: defaultDevice?.cons ?? [],
    purchase_price: defaultDevice?.purchase_price != null ? String(defaultDevice.purchase_price) : "",
    sale_price: defaultDevice?.sale_price != null ? String(defaultDevice.sale_price) : "",
    purchase_date: toDateInputValue(defaultDevice?.purchase_date, simplifiedMode),
    sale_date: toDateInputValue(defaultDevice?.sale_date, simplifiedMode)
  };
}

export function DeviceForm({
  defaultDevice,
  imageMode,
  remoteUrl,
  onImageModeChange,
  onRemoteUrlChange,
  onUploadChange,
  onSubmit,
  submitting,
  submitLabel,
  simplifiedMode = false
}: DeviceFormProps) {
  const { register, handleSubmit, control, formState, reset, watch } = useForm<DeviceFormValues>({
    defaultValues: defaultValues(defaultDevice, simplifiedMode)
  });
  const [selectedUploadName, setSelectedUploadName] = useState("");
  const [pasteHint, setPasteHint] = useState("");

  useEffect(() => {
    reset(defaultValues(defaultDevice, simplifiedMode));
  }, [defaultDevice, reset, simplifiedMode]);

  const scoreValue = Math.trunc(Number(watch("score") || 0));
  const status = watch("status");
  const isFirstPurchase = watch("is_first_purchase");
  const mountSystemKey = watch("mount_system_key");
  const saleFieldsDisabled = status === "holding" || status === "for_sale";
  const isBroken = status === "broken";

  function updateUploadFile(file: File | null, hint = "") {
    onUploadChange(file);
    setSelectedUploadName(file?.name ?? "");
    setPasteHint(hint);
  }

  function handlePaste(event: ClipboardEvent<HTMLDivElement>) {
    const clipboardItems = Array.from(event.clipboardData.items ?? []);
    const imageItem = clipboardItems.find((item) => item.type.startsWith("image/"));
    if (!imageItem) {
      setPasteHint("剪贴板里没有可用图片。");
      return;
    }

    const blob = imageItem.getAsFile();
    if (!blob) {
      setPasteHint("读取剪贴板图片失败，请改用文件选择。");
      return;
    }

    const extension = blob.type.split("/")[1] || "png";
    const file = new File([blob], `pasted-image.${extension}`, { type: blob.type });
    updateUploadFile(file, "已从剪贴板载入图片。");
  }

  const submitHandler = handleSubmit(async (values) => {
    const acquisitionIteration = values.is_first_purchase
      ? 1
      : Math.max(2, Number(values.acquisition_iteration_value || "2"));

    let salePrice: number | null = values.sale_price ? Number(values.sale_price) : null;
    let saleDate: string | null = toPayloadDate(values.sale_date, simplifiedMode);

    if (values.status === "holding" || values.status === "for_sale") {
      salePrice = null;
      saleDate = null;
    } else if (values.status === "broken") {
      salePrice = 0;
      saleDate = null;
    }

    const payload: DevicePayload = {
      name: values.name.trim(),
      brand: values.brand.trim(),
      category: values.category,
      mount_system_key: values.mount_system_key || null,
      mount_system_custom: values.mount_system_key === "other" ? values.mount_system_custom.trim() || null : null,
      status: values.status,
      score: Math.max(-1, Math.trunc(Number(values.score || "0"))),
      acquisition_iteration: acquisitionIteration,
      review_detail: values.review_detail.trim(),
      tags: values.tags,
      pros: values.pros,
      cons: values.cons,
      purchase_price: values.purchase_price ? Number(values.purchase_price) : null,
      sale_price: salePrice,
      purchase_date: toPayloadDate(values.purchase_date, simplifiedMode),
      sale_date: saleDate,
      image_source_type: defaultDevice?.image_source_type ?? null,
      image_original_url: defaultDevice?.image_original_url ?? null,
      image_storage_path: defaultDevice?.image_storage_path ?? null,
      image_storage_name: defaultDevice?.image_storage_name ?? null
    };

    await onSubmit(payload);
  });

  return (
    <form className="space-y-6" onSubmit={submitHandler}>
      <section className="panel p-5">
        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <label className="field-label">名称</label>
            <input aria-label="名称" className="input" {...register("name", { required: true })} />
            {formState.errors.name ? <p className="field-error">请输入设备名称。</p> : null}
          </div>

          <div>
            <label className="field-label">品牌</label>
            <input aria-label="品牌" className="input" {...register("brand", { required: true })} />
          </div>

          <div>
            <label className="field-label">类别</label>
            <select aria-label="类别" className="input" {...register("category")}>
              {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="field-label">卡口 / 系统</label>
            <select aria-label="卡口 / 系统" className="input" {...register("mount_system_key")}>
              {Object.entries(MOUNT_SYSTEM_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {mountSystemKey === "other" ? (
            <div className="md:col-span-2">
              <label className="field-label">其他卡口 / 系统</label>
              <input aria-label="其他卡口 / 系统" className="input" {...register("mount_system_custom")} />
            </div>
          ) : null}

          <div>
            <label className="field-label">状态</label>
            <select aria-label="状态" className="input" {...register("status")}>
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="field-label">数字评分</label>
            <input aria-label="数字评分" className="input" type="number" min={-1} step={1} {...register("score")} />
            <p className="field-help">`-1` 表示正在感受，`0` 表示暂不做评价，两者都不参与评分统计。</p>
            <p className="field-help">
              当前映射：
              <span className="ml-1 font-medium text-textPrimary">
                {isFeelingScore(scoreValue)
                  ? "正在感受"
                  : isUnratedScore(scoreValue)
                    ? "暂不做评价"
                    : ratingLabelText(scoreToRatingLabel(scoreValue))}
              </span>
            </p>
          </div>

          <label className="md:col-span-2 flex items-center gap-3 rounded-2xl border border-line bg-panelAlt px-4 py-3 text-sm text-textPrimary">
            <input type="checkbox" className="h-4 w-4 accent-[#5cc8ff]" {...register("is_first_purchase")} />
            首次购入该设备
          </label>

          {!isFirstPurchase ? (
            <div className="md:col-span-2">
              <label className="field-label">这是第几次购入</label>
              <input
                aria-label="这是第几次购入"
                className="input"
                type="number"
                min={2}
                step={1}
                {...register("acquisition_iteration_value")}
              />
            </div>
          ) : null}

          <div className="md:col-span-2">
            <label className="field-label">详细评价</label>
            <textarea aria-label="详细评价" className="textarea" {...register("review_detail")} />
          </div>
        </div>
      </section>

      <section className="panel p-5">
        <div className="grid gap-5 lg:grid-cols-3">
          <div>
            <label className="field-label">标签</label>
            <Controller
              control={control}
              name="tags"
              render={({ field }) => <StringListEditor value={field.value} onChange={field.onChange} placeholder="输入标签后回车" />}
            />
          </div>
          <div>
            <label className="field-label">优点</label>
            <Controller
              control={control}
              name="pros"
              render={({ field }) => <StringListEditor value={field.value} onChange={field.onChange} placeholder="输入优点后回车" />}
            />
          </div>
          <div>
            <label className="field-label">缺点</label>
            <Controller
              control={control}
              name="cons"
              render={({ field }) => <StringListEditor value={field.value} onChange={field.onChange} placeholder="输入缺点后回车" />}
            />
          </div>
        </div>
      </section>

      <section className="panel p-5">
        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <label className="field-label">购入价格</label>
            <input aria-label="购入价格" className="input" type="number" step="0.01" {...register("purchase_price")} />
          </div>

          {saleFieldsDisabled ? (
            <div className="rounded-2xl border border-line bg-panelAlt px-4 py-3 text-sm text-textSecondary">
              {status === "holding" ? "持有中的设备不设置售出价格和售出日期。" : "待售设备不设置售出价格和售出日期。"}
            </div>
          ) : isBroken ? (
            <div className="rounded-2xl border border-line bg-panelAlt px-4 py-3 text-sm text-textSecondary">
              已损坏设备的售出价格默认为 0，且不设置售出日期。
            </div>
          ) : (
            <div>
              <label className="field-label">售出价格</label>
              <input aria-label="售出价格" className="input" type="number" step="0.01" {...register("sale_price")} />
            </div>
          )}

          <div>
            <label className="field-label">购入日期</label>
            <input aria-label="购入日期" className="input" type={simplifiedMode ? "month" : "date"} {...register("purchase_date")} />
          </div>

          {!saleFieldsDisabled && !isBroken ? (
            <div>
              <label className="field-label">售出日期</label>
              <input aria-label="售出日期" className="input" type={simplifiedMode ? "month" : "date"} {...register("sale_date")} />
            </div>
          ) : null}
        </div>
      </section>

      {!simplifiedMode ? (
      <section className="panel p-5">
        <div className="text-xs uppercase tracking-[0.22em] text-textSecondary">设备图片</div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <button type="button" className={imageMode === "none" ? "button-primary" : "button-secondary"} onClick={() => onImageModeChange("none")}>
            不设置图片
          </button>
          <button type="button" className={imageMode === "upload" ? "button-primary" : "button-secondary"} onClick={() => onImageModeChange("upload")}>
            本地上传
          </button>
          <button type="button" className={imageMode === "remote" ? "button-primary" : "button-secondary"} onClick={() => onImageModeChange("remote")}>
            远程 URL 缓存
          </button>
        </div>

        {imageMode === "upload" ? (
          <div className="mt-4 space-y-3">
            <div
              className="rounded-2xl border border-dashed border-line bg-panelAlt/60 p-4 text-sm text-textSecondary outline-none transition focus:border-accent"
              role="button"
              tabIndex={0}
              onPaste={handlePaste}
            >
              <div className="font-medium text-textPrimary">可直接粘贴图片</div>
              <div className="mt-1">把焦点放在这里后按 `Ctrl/Cmd + V`，也可以继续使用文件选择。</div>
              {selectedUploadName ? <div className="mt-3 rounded-xl bg-panel px-3 py-2 text-textPrimary">当前文件：{selectedUploadName}</div> : null}
              {pasteHint ? <div className="mt-2 text-xs text-textSecondary">{pasteHint}</div> : null}
            </div>

            <div>
              <label className="field-label">上传文件</label>
              <input className="input" type="file" accept="image/*" onChange={(event) => updateUploadFile(event.target.files?.[0] ?? null)} />
            </div>
          </div>
        ) : null}

        {imageMode === "remote" ? (
          <div className="mt-4">
            <label className="field-label">远程图片 URL</label>
            <input className="input" value={remoteUrl} onChange={(event) => onRemoteUrlChange(event.target.value)} placeholder="https://example.com/device.jpg" />
          </div>
        ) : null}
      </section>
      ) : null}

      <div className="flex justify-end">
        <button className="button-primary min-w-36" type="submit" disabled={submitting}>
          {submitting ? "保存中..." : submitLabel ?? (defaultDevice ? "保存修改" : "创建设备")}
        </button>
      </div>
    </form>
  );
}
