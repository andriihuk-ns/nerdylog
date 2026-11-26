import { asc, inArray } from "drizzle-orm";
import { projects } from "../schema";
import type { DbOrTx } from "./types";

export interface CapProjectRow {
  id: string;
  name: string;
  monthlyHourCap: number | null;
  isActive: boolean;
}

/** Projects for cap telemetry (all, or only `ids`), sorted by name. */
export async function listCapProjects(db: DbOrTx, ids?: readonly string[]): Promise<CapProjectRow[]> {
  if (ids?.length === 0) return [];
  const query = db
    .select({
      id: projects.id,
      name: projects.name,
      monthlyHourCap: projects.monthlyHourCap,
      isActive: projects.isActive,
    })
    .from(projects);
  return (ids ? query.where(inArray(projects.id, [...ids])) : query).orderBy(asc(projects.name));
}
