import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";

import type { DeviceCategory, DeviceDetail, DevicePayload, DeviceRating, DeviceStatus } from "../../types/device";
import { CATEGORY_LABELS, RATING_LABELS, STATUS_LABELS } from "../../types/device";
import { StringListEditor } from "./StringListEditor";

export type ImageMode = "none" | "upload" | "remote";

export interface DeviceFormValues {
  name: string;
  brand: string;
  category: DeviceCategory;
  mount_system: string;
  status: DeviceStatus;
  rating: DeviceRating;
  summary: string;
  review_detail: string;
  tags: string[];
  pros: string[];
  cons: string[];
  purchase_price: string;
  sale_price: string;
  purchase_date: string;
  sale_date: string;
  is_currently_owned: boolean;
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
}

function defaultValues(defaultDevice?: DeviceDetail): DeviceFormValues {
  return {
    name: defaultDevice?.name ?? "",
    brand: defaultDevice?.brand ?? "",
    category: defaultDevice?.category ?? "camera_body",
    mount_system: defaultDevice?.mount_system ?? "",
    status: defaultDevice?.status ?? "holding",
    rating: defaultDevice?.rating ?? "excellent",
    summary: defaultDevice?.summary ?? "",
    review_detail: defaultDevice?.review_detail ?? "",
    tags: defaultDevice?.tags ?? [],
    pros: defaultDevice?.pros ?? [],
    cons: defaultDevice?.cons ?? [],
    purchase_price: defaultDevice?.purchase_price != null ? String(defaultDevice.purchase_price) : "",
    sale_price: defaultDevice?.sale_price != null ? String(defaultDevice.sale_price) : "",
    purchase_date: defaultDevice?.purchase_date ?? "",
    sale_date: defaultDevice?.sale_date ?? "",
    is_currently_owned: defaultDevice?.is_currently_owned ?? true
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
  submitting
}: DeviceFormProps) {
  const { register, handleSubmit, control, formState, reset } = useForm<DeviceFormValues>({
    defaultValues: defaultValues(defaultDevice)
  });

  useEffect(() => {
    reset(defaultValues(defaultDevice));
  }, [defaultDevice, reset]);

  const submitHandler = handleSubmit(async (values) => {
    const payload: DevicePayload = {
      name: values.name.trim(),
      brand: values.brand.trim(),
      category: values.category,
      mount_system: values.mount_system.trim() || null,
      status: values.status,
      rating: values.rating,
      summary: values.summary.trim(),
      review_detail: values.review_detail.trim(),
      tags: values.tags,
      pros: values.pros,
      cons: values.cons,
      purchase_price: values.purchase_price ? Number(values.purchase_price) : null,
      sale_price: values.sale_price ? Number(values.sale_price) : null,
      purchase_date: values.purchase_date || null,
      sale_date: values.sale_date || null,
      is_currently_owned: values.is_currently_owned,
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
            <input aria-label="名称" className="field" {...register("name", { required: true })} />
            {formState.errors.name ? <p className="mt-2 text-sm text-danger">请输入设备名称。</p> : null}
          </div>
          <div>
            <label className="field-label">品牌</label>
            <input aria-label="品牌" className="field" {...register("brand", { required: true })} />
          </div>
          <div>
            <label className="field-label">类别</label>
            <select aria-label="类别" className="field" {...register("category")}>
              {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label">卡口 / 系统</label>
            <input
              aria-label="卡口 / 系统"
              className="field"
              {...register("mount_system")}
              placeholder="例如 X Mount / E Mount"
            />
          </div>
          <div>
            <label className="field-label">状态</label>
            <select aria-label="状态" className="field" {...register("status")}>
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label">评价等级</label>
            <select aria-label="评价等级" className="field" {...register("rating")}>
              {Object.entries(RATING_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="field-label">一句话总结</label>
            <input aria-label="一句话总结" className="field" {...register("summary", { required: true })} />
          </div>
          <div className="md:col-span-2">
            <label className="field-label">详细评价</label>
            <textarea aria-label="详细评价" className="field min-h-40 resize-y" {...register("review_detail")} />
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
              render={({ field }) => (
                <StringListEditor value={field.value} onChange={field.onChange} placeholder="添加标签后回车" />
              )}
            />
          </div>
          <div>
            <label className="field-label">优点</label>
            <Controller
              control={control}
              name="pros"
              render={({ field }) => (
                <StringListEditor value={field.value} onChange={field.onChange} placeholder="录入优点后回车" />
              )}
            />
          </div>
          <div>
            <label className="field-label">缺点</label>
            <Controller
              control={control}
              name="cons"
              render={({ field }) => (
                <StringListEditor value={field.value} onChange={field.onChange} placeholder="录入缺点后回车" />
              )}
            />
          </div>
        </div>
      </section>

      <section className="panel p-5">
        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <label className="field-label">购入价格</label>
            <input aria-label="购入价格" className="field" type="number" step="0.01" {...register("purchase_price")} />
          </div>
          <div>
            <label className="field-label">售出价格</label>
            <input aria-label="售出价格" className="field" type="number" step="0.01" {...register("sale_price")} />
          </div>
          <div>
            <label className="field-label">购入日期</label>
            <input aria-label="购入日期" className="field" type="date" {...register("purchase_date")} />
          </div>
          <div>
            <label className="field-label">售出日期</label>
            <input aria-label="售出日期" className="field" type="date" {...register("sale_date")} />
          </div>
          <label className="flex items-center gap-3 rounded-2xl border border-line bg-panelAlt px-4 py-3 text-sm text-slate-200 md:col-span-2">
            <input type="checkbox" className="h-4 w-4 accent-[#5cc8ff]" {...register("is_currently_owned")} />
            当前仍然持有该设备
          </label>
        </div>
      </section>

      <section className="panel p-5">
        <div className="text-xs uppercase tracking-[0.22em] text-slate-400">设备图片</div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <button
            type="button"
            className={imageMode === "none" ? "button-primary" : "button-secondary"}
            onClick={() => onImageModeChange("none")}
          >
            不设置图片
          </button>
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
            远程 URL 缓存
          </button>
        </div>

        {imageMode === "upload" ? (
          <div className="mt-4">
            <label className="field-label">上传文件</label>
            <input
              className="field"
              type="file"
              accept="image/*"
              onChange={(event) => onUploadChange(event.target.files?.[0] ?? null)}
            />
          </div>
        ) : null}

        {imageMode === "remote" ? (
          <div className="mt-4">
            <label className="field-label">远程图片 URL</label>
            <input
              className="field"
              value={remoteUrl}
              onChange={(event) => onRemoteUrlChange(event.target.value)}
              placeholder="https://example.com/device.jpg"
            />
          </div>
        ) : null}
      </section>

      <div className="flex justify-end">
        <button className="button-primary min-w-36" type="submit" disabled={submitting}>
          {submitting ? "保存中..." : defaultDevice ? "保存修改" : "创建设备"}
        </button>
      </div>
    </form>
  );
}
