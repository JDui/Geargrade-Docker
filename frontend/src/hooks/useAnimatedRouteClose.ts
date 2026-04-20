import { useEffect, useRef, useState } from "react";

const DEFAULT_DURATION_MS = 220;

export function useAnimatedRouteClose() {
  const [isClosing, setIsClosing] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current != null) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  function requestClose(onClosed: () => void, duration = DEFAULT_DURATION_MS) {
    if (isClosing) {
      return;
    }

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) {
      onClosed();
      return;
    }

    setIsClosing(true);
    timeoutRef.current = window.setTimeout(() => {
      onClosed();
    }, duration);
  }

  return {
    isClosing,
    requestClose
  };
}
