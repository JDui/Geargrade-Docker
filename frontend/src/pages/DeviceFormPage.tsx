import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { createDevice, fetchDevice, updateDevice } from "../api/devices";
import { cacheRemoteMedia, uploadMedia } from "../api/media";
import {
  createWishlistDevice,
  fetchWishlistDevice,
  redeemWishlistDevice,
  updateWishlistDevice
} from "../api/wishlist";
import { DeviceForm, type ImageMode } from "../components/forms/DeviceForm";
import { WishlistForm } from "../components/forms/WishlistForm";
import { useDashboardSummary } from "../components/layout/DashboardSummaryProvider";
import { DataToolsSection } from "../components/tools/DataToolsSection";
import type {
  DeviceDetail,
  DevicePayload,
  WishlistDeviceDetail,
  WishlistDevicePayload,
  WishlistRedeemPayload
} from "../types/device";

interface DeviceFormPageProps {
  mode: "create" | "edit" | "redeem";
  resource?: "devices" | "wishlist";
}

function mapWishlistToDeviceDetail(device: WishlistDeviceDetail): DeviceDetail {
  return {
    ...device,
    status: "holding",
    purchase_price: null,
    sale_price: null,
    daily_cost_value: null,
    purchase_date: null,
    sale_date: null,
    score_rank: null
  };
}

export default function DeviceFormPage({ mode, resource = "devices" }: DeviceFormPageProps) {
  const { deviceId } = useParams();
  const navigate = useNavigate();
  const { refreshSummary } = useDashboardSummary();
  const [device, setDevice] = useState<DeviceDetail | undefined>(undefined);
  const [wishlistDevice, setWishlistDevice] = useState<WishlistDeviceDetail | undefined>(undefined);
  const [loading, setLoading] = useState(mode !== "create");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageMode, setImageMode] = useState<ImageMode>("none");
  const [remoteUrl, setRemoteUrl] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  const isWishlist = resource === "wishlist";
  const isRedeem = mode === "redeem";
  const listPath = isWishlist || isRedeem ? "/wishlist" : "/archive";
  const detailBasePath = isWishlist ? "/wishlist/devices" : "/archive/devices";

  const title = useMemo(() => {
    if (isRedeem) {
      return "兑现心愿设备";
    }
    if (isWishlist) {
      return mode === "create" ? "新增心愿设备" : "编辑心愿设备";
    }
    return mode === "create" ? "新增设备档案" : "编辑设备档案";
  }, [isRedeem, isWishlist, mode]);

  useEffect(() => {
    if (mode === "create" || !deviceId) {
      return;
    }

    setLoading(true);
    setError(null);

    const load = async () => {
      if (isRedeem) {
        const result = await fetchWishlistDevice(deviceId);
        setWishlistDevice(result);
        setDevice(mapWishlistToDeviceDetail(result));
        if (result.image_source_type === "upload") {
          setImageMode("upload");
        } else if (result.image_source_type === "cached_remote") {
          setImageMode("remote");
          setRemoteUrl(result.image_original_url ?? "");
        }
        return;
      }

      if (isWishlist) {
        const result = await fetchWishlistDevice(deviceId);
        setWishlistDevice(result);
        if (result.image_source_type === "upload") {
          setImageMode("upload");
        } else if (result.image_source_type === "cached_remote") {
          setImageMode("remote");
          setRemoteUrl(result.image_original_url ?? "");
        }
        return;
      }

      const result = await fetchDevice(deviceId);
      setDevice(result);
      if (result.image_source_type === "upload") {
        setImageMode("upload");
      } else if (result.image_source_type === "cached_remote") {
        setImageMode("remote");
        setRemoteUrl(result.image_original_url ?? "");
      }
    };

    load()
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [deviceId, isRedeem, isWishlist, mode]);

  async function resolveImagePayload<
    T extends {
      image_source_type: string | null;
      image_original_url: string | null;
      image_storage_path: string | null;
      image_storage_name: string | null;
    }
  >(basePayload: T): Promise<T> {
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

    const currentOriginalUrl = isWishlist ? wishlistDevice?.image_original_url : device?.image_original_url;
    const currentStoragePath = isWishlist ? wishlistDevice?.image_storage_path : device?.image_storage_path;

    if (remoteUrl === currentOriginalUrl && currentStoragePath) {
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

  async function handleDeviceSubmit(basePayload: DevicePayload) {
    setSubmitting(true);
    setError(null);
    try {
      const payload = await resolveImagePayload(basePayload);

      if (isRedeem) {
        if (!deviceId) {
          throw new Error("缺少待兑现的心愿设备 ID。");
        }

        const redeemPayload: WishlistRedeemPayload = {
          name: payload.name,
          brand: payload.brand,
          category: payload.category,
          mount_system_key: payload.mount_system_key,
          mount_system_custom: payload.mount_system_custom,
          score: payload.score,
          acquisition_iteration: payload.acquisition_iteration,
          pros: payload.pros,
          cons: payload.cons,
          review_detail: payload.review_detail,
          tags: payload.tags,
          purchase_price: payload.purchase_price ?? 0,
          purchase_date: payload.purchase_date ?? "",
          image_source_type: payload.image_source_type,
          image_original_url: payload.image_original_url,
          image_storage_path: payload.image_storage_path,
          image_storage_name: payload.image_storage_name
        };

        if (redeemPayload.purchase_price <= 0 || !redeemPayload.purchase_date) {
          throw new Error("兑现时必须填写购入价格和购入日期。");
        }

        const result = await redeemWishlistDevice(deviceId, redeemPayload);
        await refreshSummary();
        navigate(`/archive/devices/${result.id}`);
        return;
      }

      const result = mode === "create" ? await createDevice(payload) : await updateDevice(String(deviceId), payload);

      await refreshSummary();
      navigate(`${detailBasePath}/${result.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存设备失败。");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleWishlistSubmit(basePayload: WishlistDevicePayload) {
    setSubmitting(true);
    setError(null);
    try {
      const payload = await resolveImagePayload(basePayload);
      const result = mode === "create" ? await createWishlistDevice(payload) : await updateWishlistDevice(String(deviceId), payload);
      navigate(`${detailBasePath}/${result.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存心愿设备失败。");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.22em] text-accent/80">
            {isRedeem ? "Redeem" : isWishlist ? "Wishlist" : "Geargrade"}
          </div>
          <h1 className="mt-1 text-3xl font-semibold text-textPrimary">{title}</h1>
        </div>
        <Link to={listPath} className="button-secondary">
          返回列表
        </Link>
      </div>

      {error ? <div className="rounded-2xl border border-danger/40 bg-danger/10 p-4 text-danger">{error}</div> : null}
      {loading ? <div className="panel p-5 text-textSecondary">正在加载设备信息...</div> : null}

      {!loading ? (
        <>
          {isWishlist && !isRedeem ? (
            <WishlistForm
              defaultDevice={wishlistDevice}
              imageMode={imageMode}
              remoteUrl={remoteUrl}
              onImageModeChange={setImageMode}
              onRemoteUrlChange={setRemoteUrl}
              onUploadChange={setUploadFile}
              onSubmit={handleWishlistSubmit}
              submitting={submitting}
            />
          ) : (
            <DeviceForm
              defaultDevice={device}
              imageMode={imageMode}
              remoteUrl={remoteUrl}
              onImageModeChange={setImageMode}
              onRemoteUrlChange={setRemoteUrl}
              onUploadChange={setUploadFile}
              onSubmit={handleDeviceSubmit}
              submitting={submitting}
              submitLabel={isRedeem ? "完成兑现" : undefined}
            />
          )}

          {!isWishlist && !isRedeem && mode === "create" ? <DataToolsSection /> : null}
        </>
      ) : null}
    </div>
  );
}
