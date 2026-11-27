"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { ADMIN_TABS, adminHref, type AdminTab } from "./admin-tab";

/** Tabs synced to `?tab=` so reloads and links keep the panel. Panels are server-rendered. */
interface Props {
  tab: AdminTab;
  year: number;
  officeId: string | null;
  panels: Record<AdminTab, ReactNode>;
}

export function AdminTabs({ tab, year, officeId, panels }: Props) {
  const router = useRouter();
  const t = useTranslations("admin");

  return (
    <Tabs
      defaultValue={tab}
      onValueChange={(value) => {
        router.replace(adminHref(value as AdminTab, year, officeId), { scroll: false });
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
