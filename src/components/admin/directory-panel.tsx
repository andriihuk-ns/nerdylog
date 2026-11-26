"use client";

import { useTransition } from "react";
import { RefreshCw } from "lucide-react";
import type { DirectoryUser, TeamView } from "@/contracts";
import { cn } from "@/lib/utils";
import { syncFromSlackAction } from "@/app/(dashboard)/admin/actions";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Toast } from "@/components/ui/toast";
import { DirectoryRow } from "./directory-row";
import { syncSummary, teamHandlesByUser } from "./team-helpers";

/** FR-WEB-06 Team Directory: Sync from Slack (people + teams, A13), title (A12) and teams (A13) read-only, role, daily norm, PTO allowance (A9), active. */
export function DirectoryPanel({ users, teams }: { users: DirectoryUser[]; teams: TeamView[] }) {
  const { toast, show, dismiss } = useToast();
  const [syncing, startSync] = useTransition();
  const handles = teamHandlesByUser(teams);
  const sorted = [...users].sort((a, b) => Number(b.isActive) - Number(a.isActive) || a.fullName.localeCompare(b.fullName));

  function sync() {
    startSync(async () => {
      const res = await syncFromSlackAction();
      if (!res.ok) show(`Sync failed. ${res.message}`, { tone: "error", onRetry: sync });
      else if (res.data.teamsError) show(`${syncSummary(res.data)} ${res.data.teamsError}`, { tone: "error", onRetry: sync });
      else show(syncSummary(res.data));
    });
  }

  return (
    <section aria-labelledby="directory-title" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="directory-title" className="text-lg font-semibold">
            Team directory
          </h2>
          <p className="text-muted-foreground">
            <span className="tabular">{users.filter((u) => u.isActive).length}</span> active ·{" "}
            <span className="tabular">{users.filter((u) => !u.isActive).length}</span> archived
          </p>
        </div>
        <Button onClick={sync} disabled={syncing} className="hit-target">
          <RefreshCw aria-hidden className={cn(syncing && "animate-spin")} />
          {syncing ? "Syncing…" : "Sync from Slack"}
        </Button>
      </div>
      {sorted.length === 0 ? (
        <p className="rounded-lg border bg-card p-6 text-muted-foreground">
          No teammates yet. Use “Sync from Slack” to import your workspace.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b text-xs font-medium text-muted-foreground">
                <th scope="col" className="h-10 px-4 text-left font-medium">
                  Name
                </th>
                <th scope="col" className="px-2 text-left font-medium">
                  Title
                </th>
                <th scope="col" className="px-2 text-left font-medium">
                  Teams
                </th>
                <th scope="col" className="px-2 text-left font-medium">
                  Role
                </th>
                <th scope="col" className="px-2 text-right font-medium">
                  Daily norm (h)
                </th>
                <th scope="col" className="px-2 text-right font-medium">
                  Vacation days / year
                </th>
                <th scope="col" className="px-4 text-left font-medium">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((u) => (
                <DirectoryRow key={u.id} user={u} teamHandles={handles.get(u.id) ?? []} onError={(m) => show(m, { tone: "error" })} />
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Toast toast={toast} onDismiss={dismiss} />
    </section>
  );
}
