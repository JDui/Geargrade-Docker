import { useEffect } from "react";

const LOCK_COUNT_ATTR = "data-scroll-lock-count";
const LOCK_OVERFLOW_ATTR = "data-scroll-lock-overflow";
const LOCK_PADDING_ATTR = "data-scroll-lock-padding-right";

export function useBodyScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) {
      return;
    }

    const { body } = document;
    const currentCount = Number(body.getAttribute(LOCK_COUNT_ATTR) ?? "0");

    if (currentCount === 0) {
      body.setAttribute(LOCK_OVERFLOW_ATTR, body.style.overflow);
      body.setAttribute(LOCK_PADDING_ATTR, body.style.paddingRight);

      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
      body.style.overflow = "hidden";
      if (scrollbarWidth > 0) {
        body.style.paddingRight = `${scrollbarWidth}px`;
      }
    }

    body.setAttribute(LOCK_COUNT_ATTR, String(currentCount + 1));

    return () => {
      const nextCount = Math.max(0, Number(body.getAttribute(LOCK_COUNT_ATTR) ?? "1") - 1);

      if (nextCount === 0) {
        body.style.overflow = body.getAttribute(LOCK_OVERFLOW_ATTR) ?? "";
        body.style.paddingRight = body.getAttribute(LOCK_PADDING_ATTR) ?? "";
        body.removeAttribute(LOCK_COUNT_ATTR);
        body.removeAttribute(LOCK_OVERFLOW_ATTR);
        body.removeAttribute(LOCK_PADDING_ATTR);
        return;
      }

      body.setAttribute(LOCK_COUNT_ATTR, String(nextCount));
    };
  }, [active]);
}
