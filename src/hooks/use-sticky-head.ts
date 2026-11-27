import { useCallback } from "react";

/** How far the header cells move so they sit under the app header, without leaving the table. */
export function stickyHeadOffset(headerBottom: number, tableTop: number, tableHeight: number, headHeight: number) {
  const room = Math.max(0, tableHeight - headHeight * 2); // stop before covering the last rows
  return Math.min(Math.max(0, headerBottom - tableTop), room);
}

/**
 * Pins a table's `thead` under the app header while the page scrolls. CSS `position: sticky` cannot:
 * the horizontal-scroll wrapper is its own scroll container. Styles: `[data-sticky-head]` in globals.css.
 */
export function useStickyHead() {
  return useCallback((frame: HTMLDivElement | null) => {
    if (!frame) return;
    const update = () => {
      const table = frame.querySelector("table");
      if (!table?.tHead) return;
      const headerBottom = document.querySelector("[data-app-header]")?.getBoundingClientRect().bottom ?? 0;
      const box = table.getBoundingClientRect();
      const offset = stickyHeadOffset(headerBottom, box.top, box.height, table.tHead.offsetHeight);
      frame.style.setProperty("--head-offset", `${offset}px`);
      frame.toggleAttribute("data-stuck", offset > 0);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(frame);
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);
}
