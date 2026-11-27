"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { z } from "zod";
import type { ProjectOption, ProjectRef } from "./week-matrix";

const PINNED_PROJECTS_CHANGED = "nerdylog:pinned-projects-changed";
const EMPTY_PROJECT_IDS = "[]";
const pinnedProjectSnapshots = new Map<string, string>();
const memoryOnlyPinnedKeys = new Set<string>();

function getSnapshot(key: string): string {
  if (memoryOnlyPinnedKeys.has(key)) return pinnedProjectSnapshots.get(key) ?? EMPTY_PROJECT_IDS;
  try {
    const snapshot = window.localStorage.getItem(key) ?? EMPTY_PROJECT_IDS;
    pinnedProjectSnapshots.set(key, snapshot);
    return snapshot;
  } catch (error) {
    console.warn("Unable to read saved project rows.", error);
    memoryOnlyPinnedKeys.add(key);
    return pinnedProjectSnapshots.get(key) ?? EMPTY_PROJECT_IDS;
  }
}

function subscribe(key: string, onChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === key || event.key === null) onChange();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(PINNED_PROJECTS_CHANGED, onChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(PINNED_PROJECTS_CHANGED, onChange);
  };
}

function parseProjectIds(snapshot: string): string[] {
  try {
    const result = z.array(z.string().min(1)).safeParse(JSON.parse(snapshot));
    if (result.success) return [...new Set(result.data)];
    console.warn("Ignoring invalid saved project rows.");
  } catch (error) {
    console.warn("Unable to parse saved project rows.", error);
  }
  return [];
}

function updateProjectIds(key: string, update: (current: string[]) => string[]) {
  const current = parseProjectIds(getSnapshot(key));
  const next = JSON.stringify(update(current));
  pinnedProjectSnapshots.set(key, next);
  try {
    window.localStorage.setItem(key, next);
    memoryOnlyPinnedKeys.delete(key);
  } catch (error) {
    console.warn("Unable to save project rows.", error);
    memoryOnlyPinnedKeys.add(key);
  }
  window.dispatchEvent(new Event(PINNED_PROJECTS_CHANGED));
}

const getEmptySnapshot = () => EMPTY_PROJECT_IDS;

/** Persists empty project rows per person and week without creating zero-hour entries. */
export function usePinnedProjects(key: string, projects: readonly ProjectOption[]) {
  const subscribeToKey = useCallback((onChange: () => void) => subscribe(key, onChange), [key]);
  const getSnapshotForKey = useCallback(() => getSnapshot(key), [key]);
  const savedIds = useSyncExternalStore(subscribeToKey, getSnapshotForKey, getEmptySnapshot);
  const pinned = useMemo(() => {
    const available = new Map(projects.filter((project) => project.disabledReason === null).map((project) => [project.id, project]));
    return parseProjectIds(savedIds).flatMap((id) => {
      const project = available.get(id);
      return project ? [{ id: project.id, name: project.name }] : [];
    });
  }, [projects, savedIds]);

  function pin(project: ProjectRef) {
    updateProjectIds(key, (current) => current.includes(project.id) ? current : [...current, project.id]);
  }

  function unpin(projectId: string) {
    updateProjectIds(key, (current) => current.filter((id) => id !== projectId));
  }

  return { pinned, pin, unpin };
}
