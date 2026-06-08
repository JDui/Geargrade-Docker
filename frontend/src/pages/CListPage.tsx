import { useEffect, useMemo, useState } from "react";
import { useMatch } from "react-router-dom";

import { fetchDevices } from "../api/devices";
import { DeviceCListView } from "../components/devices/DeviceCListView";
import { DeviceDetailDrawer } from "../components/devices/DeviceDetailDrawer";
import { useDashboardSummary } from "../components/layout/DashboardSummaryProvider";
import { DEFAULT_FILTERS, type DeviceFilters, type DeviceListItem } from "../types/device";

export default function CListPage() {
  const drawerMatch = useMatch("/clist/devices/:deviceId");
  const { refreshSummary } = useDashboardSummary();
  const [devices, setDevices] = useState<DeviceListItem[]>([]);
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
      const result = await fetchDevices(clistFilters);
      setDevices(result.items);
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
      <section className="flex items-center justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.22em] text-accent/80">CList</div>
          <h1 className="mt-1 text-3xl font-semibold text-textPrimary">CList</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-textSecondary">
            Standalone device timeline map. Mouse wheel or pinch zooms. Drag or touchpad scroll pans.
          </p>
        </div>
      </section>

      {error ? <div className="rounded-2xl border border-danger/40 bg-danger/10 p-4 text-danger">{error}</div> : null}
      {loading ? <div className="panel p-5 text-textSecondary">Loading CList...</div> : null}

      {!loading && devices.length ? <DeviceCListView items={devices} detailBasePath="/clist/devices" /> : null}

      {!loading && !devices.length ? (
        <div className="panel p-8 text-center">
          <div className="text-lg font-medium text-textPrimary">No devices</div>
          <p className="mt-2 text-sm text-textSecondary">Add devices first, then CList can build the tree.</p>
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
