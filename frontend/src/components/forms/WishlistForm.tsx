import { useEffect, useState, type ClipboardEvent } from "react";
import { Controller, useForm } from "react-hook-form";

import type { MountSystemKey, WishlistDeviceDetail, WishlistDevicePayload } from "../../types/device";
import { CATEGORY_LABELS, MOUNT_SYSTEM_LABELS } from "../../types/device";
import { isFeelingScore, isUnratedScore, ratingLabelText, scoreToRatingLabel } from "../../utils/device";
import { StringListEditor } from "./StringListEditor";
import type { ImageMode } from "./DeviceForm";

interface WishlistFormValues {
  name: string;
  brand: string;
  category: WishlistDevicePayload["category"];
  mount_system_key: MountSystemKey;
  mount_system_custom: string;
  score: string;
  acquisition_iteration: string;
  review_detail: string;
  tags: string[];
  pros: string[];
  cons: string[];
}

interface WishlistFormProps {
  defaultDevice?: WishlistDeviceDetail;
  imageMode: ImageMode;
  remoteUrl: string;
  onImageModeChange: (mode: ImageMode) => void;
  onRemoteUrlChange: (value: string) => void;
  onUploadChange: (file: File | null) => void;
  onSubmit: (payload: WishlistDevicePayload) => Promise<void>;
  submitting: boolean;
}

function defaultValues(defaultDevice?: WishlistDeviceDetail): WishlistFormValues {
  return {
    name: defaultDevice?.name ?? "",
    brand: defaultDevice?.brand ?? "",
    category: defaultDevice?.category ?? "camera_body",
    mount_system_key: defaultDevice?.mount_system_key ?? "none",
    mount_system_custom: defaultDevice?.mount_system_custom ?? "",
    score: defaultDevice != null ? String(defaultDevice.score) : "0",
    acquisition_iteration: String(defaultDevice?.acquisition_iteration ?? 1),
    review_detail: defaultDevice?.review_detail ?? "",
    tags: defaultDevice?.tags ?? [],
    pros: defaultDevice?.pros ?? [],
    cons: defaultDevice?.cons ?? []
  };
}

export function WishlistForm({
  defaultDevice,
  imageMode,
  remoteUrl,
  onImageModeChange,
  onRemoteUrlChange,
  onUploadChange,
  onSubmit,
  submitting
}: WishlistFormProps) {
  const { register, handleSubmit, control, formState, reset, watch } = useForm<WishlistFormValues>({
    defaultValues: defaultValues(defaultDevice)
  });
  const [selectedUploadName, setSelectedUploadName] = useState("");
  const [pasteHint, setPasteHint] = useState("");

  useEffect(() => {
    reset(defaultValues(defaultDevice));
  }, [defaultDevice, reset]);

  const scoreValue = Math.trunc(Number(watch("score") || 0));
  const mountSystemKey = watch("mount_system_key");

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
    const file = new File([blob], `pasted-wishlist-image.${extension}`, { type: blob.type });
    updateUploadFile(file, "已从剪贴板载入图片。");
  }

  const submitHandler = handleSubmit(async (values) => {
    const payload: WishlistDevicePayload = {
      name: values.name.trim(),
      brand: values.brand.trim(),
      category: values.category,
      mount_system_key: values.mount_system_key || null,
      mount_system_custom: values.mount_system_key === "other" ? values.mount_system_custom.trim() || null : null,
      score: Math.max(-1, Math.trunc(Number(values.score || "0"))),
      acquisition_iteration: Math.max(1, Math.trunc(Number(values.acquisition_iteration || "1"))),
      review_detail: values.review_detail.trim(),
      tags: values.tags,
      pros: values.pros,
      cons: values.cons,
      image_source_type: defaultDevice?.image_source_type ?? null,
      image_original_url: defaultDevice?.image_original_url ?? null,
      image_storage_path: defaultDevice?.image_storage_path ?? null,
      image_storage_name: defaultDevice?.image_storage_name ?? null
    };

    await onSubmit(payload);
  });

  const derivedRating = scoreToRatingLabel(scoreValue);
  const scoreStateText = isFeelingScore(scoreValue)
    ? "感受中，不参与评分体系"
    : isUnratedScore(scoreValue)
      ? "暂不做评价，不参与评分体系"
      : `映射评级：${ratingLabelText(derivedRating)}`;

  return (
    <form className="space-y-8" onSubmit={submitHandler}>
      <section className="grid gap-4 md:grid-cols-2">
        <label className="field">
          <span className="field-label">名称</span>
          <input className="input" {...register("name", { required: "请输入名称" })} placeholder="例如 Leica Q3" />
          {formState.errors.name ? <span className="field-error">{formState.errors.name.message}</span> : null}
        </label>

        <label className="field">
          <span className="field-label">品牌</span>
          <input className="input" {...register("brand", { required: "请输入品牌" })} placeholder="例如 Leica" />
          {formState.errors.brand ? <span className="field-error">{formState.errors.brand.message}</span> : null}
        </label>

        <label className="field">
          <span className="field-label">类别</span>
          <select className="input" {...register("category")}>
            {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <div className="field">
          <span className="field-label">卡口系统</span>
          <select className="input" {...register("mount_system_key")}>
            {Object.entries(MOUNT_SYSTEM_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {mountSystemKey === "other" ? (
          <label className="field md:col-span-2">
            <span className="field-label">自定义卡口</span>
            <input className="input" {...register("mount_system_custom")} placeholder="输入自定义系统名称" />
          </label>
        ) : null}
      </section>

      <section className="grid gap-4 md:grid-cols-[minmax(0,1fr),minmax(0,1fr)]">
        <label className="field">
          <span className="field-label">数字评分</span>
          <input
            type="number"
            className="input"
            {...register("score", { required: "请输入评分" })}
            placeholder="默认 0，表示暂不做评价"
          />
          <span className="field-help">{scoreStateText}</span>
        </label>

        <label className="field">
          <span className="field-label">第几次想要购入</span>
          <input
            type="number"
            min={1}
            className="input"
            {...register("acquisition_iteration", { required: "请输入次数" })}
          />
        </label>
      </section>

      <label className="field">
        <span className="field-label">详细评价</span>
        <textarea className="input min-h-[160px]" {...register("review_detail")} placeholder="记录你为什么想买、为什么想回购，或者你对它的主观印象。" />
      </label>

      <section className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-2">
          <div className="field-label">标签</div>
          <Controller
            name="tags"
            control={control}
            render={({ field }) => <StringListEditor value={field.value} onChange={field.onChange} placeholder="输入标签后回车" />}
          />
        </div>
        <div className="space-y-2">
          <div className="field-label">优点 / 吸引点</div>
          <Controller
            name="pros"
            control={control}
            render={({ field }) => <StringListEditor value={field.value} onChange={field.onChange} placeholder="输入优点后回车" />}
          />
        </div>
        <div className="space-y-2">
          <div className="field-label">缺点 / 顾虑点</div>
          <Controller
            name="cons"
            control={control}
            render={({ field }) => <StringListEditor value={field.value} onChange={field.onChange} placeholder="输入顾虑后回车" />}
          />
        </div>
      </section>

      <section className="space-y-4 rounded-3xl border border-line bg-panelAlt/60 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-medium text-textPrimary">图片</div>
            <div className="text-sm text-textSecondary">支持本地上传、直接粘贴图片，或用远程 URL 下载缓存。</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={imageMode === "upload" ? "button-primary" : "button-secondary"}
              onClick={() => onImageModeChange("upload")}
            >
              本地上传
            </button>
            <button
              type="button"
              className={imageMode === "remote" ? "button-primary" : "button-secondary"}
              onClick={() => onImageModeChange("remote")}
            >
              远程 URL
            </button>
          </div>
        </div>

        {imageMode === "upload" ? (
          <div
            className="rounded-2xl border border-dashed border-line bg-surface px-4 py-5"
            onPaste={handlePaste}
            tabIndex={0}
          >
            <div className="flex flex-wrap items-center gap-3">
              <label className="button-secondary cursor-pointer">
                选择图片
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => updateUploadFile(event.target.files?.[0] ?? null)}
                />
              </label>
              <span className="text-sm text-textSecondary">
                {selectedUploadName || "也可以先点击这里聚焦后，直接 Ctrl+V 粘贴图片"}
              </span>
            </div>
            {pasteHint ? <div className="mt-3 text-sm text-textSecondary">{pasteHint}</div> : null}
          </div>
        ) : (
          <label className="field">
            <span className="field-label">远程图片 URL</span>
            <input
              className="input"
              value={remoteUrl}
              onChange={(event) => onRemoteUrlChange(event.target.value)}
              placeholder="https://example.com/image.jpg"
            />
          </label>
        )}
      </section>

      <div className="flex flex-wrap justify-end gap-3">
        <button type="submit" className="button-primary" disabled={submitting}>
          {submitting ? "保存中..." : "保存心愿设备"}
        </button>
      </div>
    </form>
  );
}
