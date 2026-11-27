"use client";

import { useSyncExternalStore, type ReactNode } from "react";

function subscribe(onChange: () => void) {
  window.addEventListener("load", onChange);
  return () => window.removeEventListener("load", onChange);
}

const isLoaded = () => document.readyState === "complete";
const onServer = () => false;

/** A div that gets `data-loaded` once the whole page has loaded, so CSS can wait for it. */
export function AfterPageLoad({ className, children }: { className?: string; children: ReactNode }) {
  const loaded = useSyncExternalStore(subscribe, isLoaded, onServer);
  return (
    <div className={className} data-loaded={loaded || undefined}>
      {children}
    </div>
  );
}
