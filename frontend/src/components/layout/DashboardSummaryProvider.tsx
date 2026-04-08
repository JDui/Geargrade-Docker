import { createContext, type PropsWithChildren, useContext, useEffect, useState } from "react";

import { fetchDashboardSummary } from "../../api/dashboard";
import type { DashboardSummary } from "../../types/device";

interface DashboardSummaryContextValue {
  summary: DashboardSummary | null;
  refreshSummary: () => Promise<void>;
}

const DashboardSummaryContext = createContext<DashboardSummaryContextValue | null>(null);

export function DashboardSummaryProvider({ children }: PropsWithChildren) {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);

  async function refreshSummary() {
    try {
      const nextSummary = await fetchDashboardSummary();
      setSummary(nextSummary);
    } catch {
      setSummary(null);
    }
  }

  useEffect(() => {
    refreshSummary().catch(() => undefined);
  }, []);

  return (
    <DashboardSummaryContext.Provider
      value={{
        summary,
        refreshSummary
      }}
    >
      {children}
    </DashboardSummaryContext.Provider>
  );
}

export function useDashboardSummary() {
  const context = useContext(DashboardSummaryContext);
  if (!context) {
    throw new Error("useDashboardSummary must be used within DashboardSummaryProvider.");
  }
  return context;
}
