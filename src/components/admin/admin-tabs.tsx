"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { ADMIN_TABS, type AdminTab } from "./admin-tab";

/** Tabs synced to `?tab=` so reloads and links keep the panel. Panels are server-rendered. */
export function AdminTabs({ tab, year, panels }: { tab: AdminTab; year: number; panels: Record<AdminTab, ReactNode> }) {
  const router = useRouter();
  const t = useTranslations("admin");

  return (
    <Tabs
      defaultValue={tab}
      onValueChange={(value) => {
        router.replace(`/admin?tab=${value}&year=${year}`, { scroll: false });
      }}
      className="flex flex-col gap-6"
    >
      <TabsList aria-label={t("tabsLabel")}>
        {ADMIN_TABS.map((value) => (
          <TabsTrigger key={value} value={value} className="px-4">
            {t(`tabs.${value}`)}
          </TabsTrigger>
        ))}
      </TabsList>
      {ADMIN_TABS.map((value) => (
        <TabsContent key={value} value={value}>
          {panels[value]}
        </TabsContent>
      ))}
    </Tabs>
  );
}
