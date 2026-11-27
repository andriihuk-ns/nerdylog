"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface Props {
  children: ReactNode; // the frame content, including one <table> with a <thead>
  /** Classes of the horizontally scrolling frame around the table. */
  className?: string;
  /** How many header rows float (all by default). Rows with controls must not be copied. */
  rows?: number;
}

/** A static copy of the table head, sized from the real cells. */
function copyHead(table: HTMLTableElement, rows?: number) {
  const copy = table.cloneNode(false) as HTMLTableElement;
  copy.removeAttribute("role");
  copy.removeAttribute("aria-label");
  const colgroup = table.querySelector(":scope > colgroup");
  if (colgroup) copy.append(colgroup.cloneNode(true));
  const head = table.tHead!.cloneNode(true) as HTMLTableSectionElement;
  const count = Math.min(rows ?? head.rows.length, head.rows.length);
  while (head.rows.length > count) head.deleteRow(-1);
  for (let r = 0; r < count; r += 1) {
    Array.from(head.rows[r].cells).forEach((cell, c) => {
      const source = table.tHead!.rows[r].cells[c].getBoundingClientRect();
      cell.style.boxSizing = "border-box";
      cell.style.width = cell.style.minWidth = cell.style.maxWidth = `${source.width}px`;
      cell.style.height = `${source.height}px`;
    });
  }
  head.querySelectorAll("[id]").forEach((node) => node.removeAttribute("id"));
  copy.append(head);
  copy.style.tableLayout = "fixed";
  copy.style.width = `${table.getBoundingClientRect().width}px`;
  return copy;
}

/**
 * A table head that stays under the app header while the page scrolls, without lag. The real head
 * cannot be `position: sticky` because its horizontal-scroll frame is its own scroll container, so a
 * visual copy sits outside the frame, where the browser pins it. It covers the real head exactly
 * until the page scrolls; screen readers and the keyboard only see the real table.
 */
export function FloatingHead({ children, className, rows }: Props) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    const track = trackRef.current;
    const strip = stripRef.current;
    const frame = frameRef.current;
    if (!wrapper || !track || !strip || !frame) return;

    // Vertical pinning is pure CSS; this only restyles the top edge once the copy has moved.
    const edge = () => {
      const stuck = strip.getBoundingClientRect().top > track.getBoundingClientRect().top + 0.5;
      // Stuck: the app header already draws the line above, so a second one would read as 2px.
      strip.classList.toggle("border-t-transparent", stuck);
      strip.classList.toggle("rounded-t-lg", !stuck && track.offsetTop <= 0);
    };
    const follow = () => {
      strip.scrollLeft = frame.scrollLeft;
    };
    const lead = () => {
      frame.scrollLeft = strip.scrollLeft;
    };
    const build = () => {
      const table = frame.querySelector("table");
      if (!table?.tHead) {
        strip.replaceChildren();
        track.hidden = true;
        return;
      }
      track.hidden = false;
      strip.replaceChildren(copyHead(table, rows));
      const box = table.getBoundingClientRect();
      // The strip has a 1px border, like the frame; the track ends early so the copy leaves with the table.
      track.style.top = `${box.top - wrapper.getBoundingClientRect().top - 1}px`;
      track.style.bottom = `${table.tHead.offsetHeight}px`;
      follow();
      edge();
    };

    build();
    const resize = new ResizeObserver(build);
    resize.observe(frame);
    const table = frame.querySelector("table");
    if (table) resize.observe(table);
    const mutation = new MutationObserver(build);
    mutation.observe(frame, { subtree: true, childList: true, characterData: true, attributes: true });
    frame.addEventListener("scroll", follow, { passive: true });
    strip.addEventListener("scroll", lead, { passive: true });
    window.addEventListener("scroll", edge, { passive: true });
    return () => {
      resize.disconnect();
      mutation.disconnect();
      frame.removeEventListener("scroll", follow);
      strip.removeEventListener("scroll", lead);
      window.removeEventListener("scroll", edge);
    };
  }, [rows]);

  return (
    <div ref={wrapperRef} className="relative isolate flow-root">
      <div ref={trackRef} aria-hidden className="pointer-events-none absolute inset-x-0 z-10">
        {/* top = app header height (h-14 + 1px border). Not `inert`: it must catch clicks, or they reach hidden rows. */}
        <div ref={stripRef} className="pointer-events-auto sticky top-[57px] overflow-x-auto border-x border-t bg-card [scrollbar-width:none]" />
      </div>
      <div ref={frameRef} className={cn("isolate overflow-x-auto", className)}>
        {children}
      </div>
    </div>
  );
}
