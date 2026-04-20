import { Navigate, Outlet, Route, Routes } from "react-router-dom";

import { AppShell } from "../components/layout/AppShell";
import ArchivePage from "../pages/ArchivePage";
import DashboardPage from "../pages/DashboardPage";
import DeviceFormPage from "../pages/DeviceFormPage";
import LeaderboardsPage from "../pages/LeaderboardsPage";
import WishlistPage from "../pages/WishlistPage";

function OverviewLayout() {
  return (
    <>
      <DashboardPage />
      <Outlet />
    </>
  );
}

function ArchiveLayout() {
  return (
    <>
      <ArchivePage />
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

function WishlistLayout() {
  return (
    <>
      <WishlistPage />
      <Outlet />
    </>
  );
}

export function AppRouter() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<OverviewLayout />}>
          <Route path="holding" element={null} />
          <Route path="holding/devices/:deviceId" element={null} />
          <Route path="devices/:deviceId" element={null} />
        </Route>
        <Route path="/archive" element={<ArchiveLayout />}>
          <Route path="devices/:deviceId" element={null} />
        </Route>
        <Route path="/leaderboards" element={<LeaderboardsLayout />}>
          <Route path="devices/:deviceId" element={null} />
        </Route>
        <Route path="/wishlist" element={<WishlistLayout />}>
          <Route path="devices/:deviceId" element={null} />
        </Route>
        <Route path="/devices/new" element={<DeviceFormPage mode="create" resource="devices" />} />
        <Route path="/devices/:deviceId/edit" element={<DeviceFormPage mode="edit" resource="devices" />} />
        <Route path="/wishlist/new" element={<DeviceFormPage mode="create" resource="wishlist" />} />
        <Route path="/wishlist/:deviceId/edit" element={<DeviceFormPage mode="edit" resource="wishlist" />} />
        <Route path="/wishlist/devices/:deviceId/redeem" element={<DeviceFormPage mode="redeem" resource="devices" />} />
        <Route path="/data-tools" element={<Navigate to="/devices/new#data-tools" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
