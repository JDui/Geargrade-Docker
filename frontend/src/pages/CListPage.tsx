import { useEffect, useMemo, useState } from "react";
import { useMatch } from "react-router-dom";

import { fetchDevices } from "../api/devices";
import { fetchWishlistDevices } from "../api/wishlist";
import { DeviceCListView } from "../components/devices/DeviceCListView";
import { DeviceDetailDrawer } from "../components/devices/DeviceDetailDrawer";
import { useDashboardSummary } from "../components/layout/DashboardSummaryProvider";
import {
  DEFAULT_FILTERS,
  DEFAULT_WISHLIST_FILTERS,
  type DeviceFilters,
  type DeviceListItem,
  type WishlistDeviceListItem
} from "../types/device";

export default function CListPage() {
  const drawerMatch = useMatch("/clist/devices/:deviceId");
  const { refreshSummary } = useDashboardSummary();
  const [devices, setDevices] = useState<DeviceListItem[]>([]);
  const [wishlistItems, setWishlistItems] = useState<WishlistDeviceListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const clistFilters = useMemo<DeviceFilters>(
    () => ({
      ...DEFAULT_FILTERS,
      sortBy: "purchase_date",
      sortOrder: "asc"
    }),
    []
  );

  async function loadDevices() {
    setLoading(true);
    setError(null);
    try {
      const [deviceResult, wishlistResult] = await Promise.all([
        fetchDevices(clistFilters),
        fetchWishlistDevices(DEFAULT_WISHLIST_FILTERS)
      ]);
      setDevices(deviceResult.items);
      setWishlistItems(wishlistResult.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load CList.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDevices().catch(() => undefined);
  }, [clistFilters]);

  return (
    <div className="space-y-5 sm:space-y-6">
      {error ? <div className="rounded-2xl border border-danger/40 bg-danger/10 p-4 text-danger">{error}</div> : null}
      {loading ? <div className="panel p-5 text-textSecondary">Loading CList...</div> : null}

      {!loading && (devices.length || wishlistItems.length) ? (
        <DeviceCListView items={devices} wishlistItems={wishlistItems} detailBasePath="/clist/devices" />
      ) : null}

      {!loading && !devices.length && !wishlistItems.length ? (
        <div className="panel p-8 text-center">
          <div className="text-lg font-medium text-textPrimary">No devices</div>
        </div>
      ) : null}

      {drawerMatch?.params.deviceId ? (
        <DeviceDetailDrawer
          deviceId={drawerMatch.params.deviceId}
          closeTo="/clist"
          onChanged={() => {
            loadDevices().catch(() => undefined);
            refreshSummary().catch(() => undefined);
          }}
        />
      ) : null}
    </div>
  );
}
