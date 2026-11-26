"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { ADMIN_TABS, type AdminTab } from "./admin-tab";

const LABEL: Record<AdminTab, string> = { directory: "Directory", teams: "Teams", projects: "Projects", holidays: "Holidays", settings: "Settings" };

/** Tabs synced to `?tab=` so reloads and links keep the panel. Panels are server-rendered. */
export function AdminTabs({ tab, year, panels }: { tab: AdminTab; year: number; panels: Record<AdminTab, ReactNode> }) {
  const router = useRouter();

  return (
    <Tabs
      defaultValue={tab}
      onValueChange={(value) => {
        router.replace(`/admin?tab=${value}&year=${year}`, { scroll: false });
      }}
      className="flex flex-col gap-6"
    >
      <TabsList aria-label="Admin sections">
        {ADMIN_TABS.map((t) => (
          <TabsTrigger key={t} value={t} className="hit-target px-4">
            {LABEL[t]}
          </TabsTrigger>
        ))}
      </TabsList>
      {ADMIN_TABS.map((t) => (
        <TabsContent key={t} value={t}>
          {panels[t]}
        </TabsContent>
      ))}
    </Tabs>
  );
}
