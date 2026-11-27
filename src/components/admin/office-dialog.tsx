"use client";

import { useTranslations } from "next-intl";
import type { OfficeView } from "@/contracts";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { OfficeForm } from "./office-form";

interface Props {
  open: boolean;
  office?: OfficeView; // omitted → create
  onDone: (office: OfficeView, created: boolean) => void;
  onClose: () => void;
}

/** Centered modal for creating or editing an office. */
export function OfficeDialog({ open, office, onDone, onClose }: Props) {
  const t = useTranslations("admin.offices");
  return (
    <Dialog open={open} onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogContent aria-describedby={undefined} className="overflow-y-auto p-0 sm:max-w-md">
        <DialogHeader className="px-4 pt-5 sm:px-6">
          <DialogTitle>{office ? t("editLabel", { name: office.name }) : t("newLabel")}</DialogTitle>
        </DialogHeader>
        <OfficeForm office={office} onDone={onDone} onCancel={onClose} />
      </DialogContent>
    </Dialog>
  );
}
