import type { ReactNode } from "react";
import { Outlet, useLocation } from "react-router-dom";

export function pageKey(pathname: string) {
  if (pathname === "/" || pathname === "/holding" || /^\/devices\/\d+$/.test(pathname) || /^\/holding\/devices\/\d+$/.test(pathname)) {
    return "overview";
  }
  if (pathname.startsWith("/archive")) {
    return "archive";
  }
  if (pathname.startsWith("/leaderboards")) {
    return "leaderboards";
  }
  if (pathname.startsWith("/wishlist")) {
    return "wishlist";
  }
  if (pathname.startsWith("/devices/")) {
    return "devices-form";
  }
  return pathname;
}

export function isDrawerRoute(pathname: string) {
  return (
    /^\/devices\/\d+$/.test(pathname) ||
    /^\/holding(\/devices\/\d+)?$/.test(pathname) ||
    /^\/archive\/devices\/\d+$/.test(pathname) ||
    /^\/leaderboards\/devices\/\d+$/.test(pathname) ||
    /^\/wishlist\/devices\/\d+$/.test(pathname)
  );
}

export function PageTransition({ children }: { children?: ReactNode }) {
  const location = useLocation();
  const key = pageKey(location.pathname);

  return (
    <div key={key} className="motion-page-switch">
      {children ?? <Outlet />}
    </div>
  );
}
