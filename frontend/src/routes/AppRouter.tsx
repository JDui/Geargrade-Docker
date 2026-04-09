import { Navigate, Outlet, Route, Routes } from "react-router-dom";

import { AppShell } from "../components/layout/AppShell";
import DataToolsPage from "../pages/DataToolsPage";
import DashboardPage from "../pages/DashboardPage";
import DeviceFormPage from "../pages/DeviceFormPage";
import LeaderboardsPage from "../pages/LeaderboardsPage";

function DashboardLayout() {
  return (
    <>
      <DashboardPage />
      <Outlet />
    </>
  );
}

function LeaderboardsLayout() {
  return (
    <>
      <LeaderboardsPage />
      <Outlet />
    </>
  );
}

export function AppRouter() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<DashboardLayout />}>
          <Route path="devices/:deviceId" element={null} />
        </Route>
        <Route path="/leaderboards" element={<LeaderboardsLayout />}>
          <Route path="devices/:deviceId" element={null} />
        </Route>
        <Route path="/data-tools" element={<DataToolsPage />} />
        <Route path="/devices/new" element={<DeviceFormPage mode="create" />} />
        <Route path="/devices/:deviceId/edit" element={<DeviceFormPage mode="edit" />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
