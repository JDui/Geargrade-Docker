import { useEffect, useRef, useState } from "react";

const DEFAULT_DURATION_MS = 220;
const ENTER_DURATION_MS = 16;

type DrawerPhase = "closed" | "entering" | "open" | "closing";

export function useAnimatedRouteClose(active = true) {
  const [phase, setPhase] = useState<DrawerPhase>(active ? "entering" : "closed");
  const closeTimeoutRef = useRef<number | null>(null);
  const openTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current != null) {
        window.clearTimeout(closeTimeoutRef.current);
      }
      if (openTimeoutRef.current != null) {
        window.clearTimeout(openTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (!active) {
      if (closeTimeoutRef.current != null) {
        window.clearTimeout(closeTimeoutRef.current);
        closeTimeoutRef.current = null;
      }
      if (openTimeoutRef.current != null) {
        window.clearTimeout(openTimeoutRef.current);
        openTimeoutRef.current = null;
      }
      setPhase("closed");
      return;
    }

    if (prefersReducedMotion) {
      setPhase("open");
      return;
    }

    setPhase((current) => (current === "open" ? current : "entering"));
    openTimeoutRef.current = window.setTimeout(() => {
      setPhase("open");
      openTimeoutRef.current = null;
    }, ENTER_DURATION_MS);

    return () => {
      if (openTimeoutRef.current != null) {
        window.clearTimeout(openTimeoutRef.current);
        openTimeoutRef.current = null;
      }
    };
  }, [active]);

  function requestClose(onClosed: () => void, duration = DEFAULT_DURATION_MS) {
    if (phase === "closing" || phase === "closed") {
      return;
    }

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) {
      setPhase("closed");
      onClosed();
      return;
    }

    if (openTimeoutRef.current != null) {
      window.clearTimeout(openTimeoutRef.current);
      openTimeoutRef.current = null;
    }

    setPhase("closing");
    closeTimeoutRef.current = window.setTimeout(() => {
      setPhase("closed");
      closeTimeoutRef.current = null;
      onClosed();
    }, duration);
  }

  return {
    phase,
    isMounted: phase !== "closed",
    isClosing: phase === "closing",
    requestClose
  };
}
