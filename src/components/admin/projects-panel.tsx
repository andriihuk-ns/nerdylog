"use client";

import { useState } from "react";
import { Pencil, Plus } from "lucide-react";
import type { ProjectView } from "@/contracts";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Toast } from "@/components/ui/toast";
import { formatHours } from "@/components/lib/format";
import { ProjectForm } from "./project-form";

/** FR-WEB-06 Projects & Caps. Archived projects stay listed (muted) so they can be re-activated. */
export function ProjectsPanel({ projects }: { projects: ProjectView[] }) {
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const { toast, show, dismiss } = useToast();
  const sorted = [...projects].sort((a, b) => Number(b.isActive) - Number(a.isActive) || a.name.localeCompare(b.name));
  const done = (message: string) => {
    setEditing(null);
    show(message);
  };

  return (
    <section aria-labelledby="projects-title" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="projects-title" className="text-lg font-semibold">
          Projects &amp; caps
        </h2>
        <Button onClick={() => setEditing("new")} disabled={editing === "new"} className="hit-target">
          <Plus aria-hidden />
          New project
        </Button>
      </div>
      <div className="overflow-x-auto rounded-lg border bg-card">
        {editing === "new" ? (
          <div className="border-b">
            <ProjectForm onDone={done} onCancel={() => setEditing(null)} />
          </div>
        ) : null}
        {sorted.length === 0 && editing !== "new" ? (
          <p className="p-6 text-muted-foreground">No projects yet. Create one to start logging time.</p>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b text-xs font-medium text-muted-foreground">
                <th scope="col" className="h-10 px-4 text-left font-medium">Name</th>
                <th scope="col" className="px-3 text-left font-medium">Code</th>
                <th scope="col" className="px-3 text-right font-medium">Monthly cap</th>
                <th scope="col" className="px-3 text-left font-medium">Billable</th>
                <th scope="col" className="px-3 text-left font-medium">Status</th>
                <th scope="col" className="px-4 text-right font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((p) =>
                editing === p.id ? (
                  <tr key={p.id} className="border-b last:border-b-0">
                    <td colSpan={6}>
                      <ProjectForm project={p} onDone={done} onCancel={() => setEditing(null)} />
                    </td>
                  </tr>
                ) : (
                  <tr key={p.id} className={cn("h-11 border-b last:border-b-0", !p.isActive && "text-muted-foreground")}>
                    <th scope="row" className="px-4 text-left font-medium">{p.name}</th>
                    <td className="px-3 font-mono text-xs">{p.code ?? "—"}</td>
                    <td className="tabular px-3 text-right font-medium">
                      {p.monthlyHourCap === null ? <span className="text-muted-foreground">No cap</span> : `${formatHours(p.monthlyHourCap)}h`}
                    </td>
                    <td className="px-3">{p.isBillable ? "Billable" : "Non-billable"}</td>
                    <td className="px-3">{p.isActive ? "Active" : "Archived"}</td>
                    <td className="px-2 text-right">
                      <Button variant="ghost" size="icon" className="hit-target" onClick={() => setEditing(p.id)} aria-label={`Edit ${p.name}`}>
                        <Pencil aria-hidden />
                      </Button>
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        )}
      </div>
      <Toast toast={toast} onDismiss={dismiss} />
    </section>
  );
}
