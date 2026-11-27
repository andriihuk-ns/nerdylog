"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Clock, MapPin, Pencil, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import type { OfficeView } from "@/contracts";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Toast } from "@/components/ui/toast";
import { useToast } from "@/hooks/use-toast";
import { adminHref, officeHref, OFFICE_TABS, type OfficeTab } from "./admin-tab";
import { OfficeDialog } from "./office-dialog";

interface Props {
  office: OfficeView;
  tab: OfficeTab;
  year: number;
  panels: Record<OfficeTab, ReactNode>;
}

/** Office page (A37), laid out like the project page: back link, name with metadata, then People / Holidays. */
export function OfficeDetailPanel({ office, tab, year, panels }: Props) {
  const t = useTranslations("admin.offices");
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const { toast, show, dismiss } = useToast();

  function done(saved: OfficeView) {
    setEditing(false);
    show(t("saved", { name: saved.name }));
  }

  const facts = [
    { label: t("code"), Icon: MapPin, value: office.code },
    { label: t("columns.members"), Icon: Users, value: t("memberCount", { count: office.memberCount }) },
    { label: t("timezone"), Icon: Clock, value: office.timezone },
  ];

  return (
    <section className="flex flex-col gap-6" aria-labelledby="office-detail-title">
      <Link href={adminHref("offices")} className="inline-flex min-h-11 w-fit items-center gap-2 rounded-sm text-sm font-medium text-muted-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <ArrowLeft aria-hidden className="size-4" />
        {t("backToOffices")}
      </Link>

      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h1 id="office-detail-title" className="truncate text-2xl font-semibold tracking-tight">{office.name}</h1>
          <dl className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
            {facts.map(({ label, Icon, value }) => (
              <div key={label} className="inline-flex items-center gap-1.5">
                <dt className="sr-only">{label}</dt>
                <dd className="inline-flex items-center gap-1.5"><Icon aria-hidden className="size-4 shrink-0" />{value}</dd>
              </div>
            ))}
          </dl>
        </div>
        <Button variant="ghost" size="icon" className="hit-target" onClick={() => setEditing(true)} aria-label={t("edit", { name: office.name })}>
          <Pencil aria-hidden />
        </Button>
      </header>

      <Tabs
        defaultValue={tab}
        onValueChange={(value) => router.replace(officeHref(office.id, value as OfficeTab, year), { scroll: false })}
        className="flex flex-col gap-4"
      >
        <TabsList aria-label={t("tabsLabel")} className="w-full sm:w-max">
          {OFFICE_TABS.map((value) => (
            <TabsTrigger key={value} value={value} className="px-4">
              {t(`tabs.${value}`)}
            </TabsTrigger>
          ))}
        </TabsList>
        {OFFICE_TABS.map((value) => (
          <TabsContent key={value} value={value}>
            {panels[value]}
          </TabsContent>
        ))}
      </Tabs>
      <OfficeDialog open={editing} office={office} onDone={done} onClose={() => setEditing(false)} />
      <Toast toast={toast} onDismiss={dismiss} />
    </section>
  );
}
