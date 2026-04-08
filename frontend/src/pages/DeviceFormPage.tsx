import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { createDevice, fetchDevice, updateDevice } from "../api/devices";
import { cacheRemoteMedia, uploadMedia } from "../api/media";
import { DeviceForm, type ImageMode } from "../components/forms/DeviceForm";
import { useDashboardSummary } from "../components/layout/DashboardSummaryProvider";
import type { DeviceDetail, DevicePayload } from "../types/device";

interface DeviceFormPageProps {
  mode: "create" | "edit";
}

export default function DeviceFormPage({ mode }: DeviceFormPageProps) {
  const { deviceId } = useParams();
  const navigate = useNavigate();
  const { refreshSummary } = useDashboardSummary();
  const [device, setDevice] = useState<DeviceDetail | undefined>(undefined);
  const [loading, setLoading] = useState(mode === "edit");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageMode, setImageMode] = useState<ImageMode>("none");
  const [remoteUrl, setRemoteUrl] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  useEffect(() => {
    if (mode !== "edit" || !deviceId) {
      return;
    }

    setLoading(true);
    fetchDevice(deviceId)
      .then((result) => {
        setDevice(result);
        if (result.image_source_type === "upload") {
          setImageMode("upload");
        } else if (result.image_source_type === "cached_remote") {
          setImageMode("remote");
          setRemoteUrl(result.image_original_url ?? "");
        }
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [deviceId, mode]);

  const title = useMemo(() => (mode === "create" ? "新增设备档案" : "编辑设备档案"), [mode]);

  async function resolveImagePayload(basePayload: DevicePayload): Promise<DevicePayload> {
    if (imageMode === "none") {
      return {
        ...basePayload,
        image_source_type: null,
        image_original_url: null,
        image_storage_path: null,
        image_storage_name: null
      };
    }

    if (imageMode === "upload") {
      if (uploadFile) {
        const media = await uploadMedia(uploadFile);
        return {
          ...basePayload,
          image_source_type: media.source_type,
          image_original_url: media.original_url,
          image_storage_path: media.storage_path,
          image_storage_name: media.storage_name
        };
      }

      return basePayload;
    }

    if (!remoteUrl.trim()) {
      throw new Error("请输入远程图片 URL。");
    }

    if (remoteUrl === device?.image_original_url && device?.image_storage_path) {
      return basePayload;
    }

    const media = await cacheRemoteMedia(remoteUrl.trim());
    return {
      ...basePayload,
      image_source_type: media.source_type,
      image_original_url: media.original_url,
      image_storage_path: media.storage_path,
      image_storage_name: media.storage_name
    };
  }

  async function handleSubmit(basePayload: DevicePayload) {
    setSubmitting(true);
    setError(null);
    try {
      const payload = await resolveImagePayload(basePayload);
      const result =
        mode === "create"
          ? await createDevice(payload)
          : await updateDevice(String(deviceId), payload);
      await refreshSummary();
      navigate(`/devices/${result.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存设备失败。");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.22em] text-accent/80">Geargrade</div>
          <h1 className="mt-1 text-3xl font-semibold text-textPrimary">{title}</h1>
        </div>
        <Link to="/" className="button-secondary">
          返回首页
        </Link>
      </div>

      {error ? <div className="rounded-2xl border border-danger/40 bg-danger/10 p-4 text-danger">{error}</div> : null}
      {loading ? <div className="panel p-5 text-textSecondary">正在加载设备信息...</div> : null}

      {!loading ? (
        <DeviceForm
          defaultDevice={device}
          imageMode={imageMode}
          remoteUrl={remoteUrl}
          onImageModeChange={setImageMode}
          onRemoteUrlChange={setRemoteUrl}
          onUploadChange={setUploadFile}
          onSubmit={handleSubmit}
          submitting={submitting}
        />
      ) : null}
    </div>
  );
}
