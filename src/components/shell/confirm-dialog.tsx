"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export interface ConfirmOptions {
  title: string; // "Delete project “TEST”?"
  description?: string; // "This can't be undone."
  confirmLabel: string; // "Delete"
  destructive?: boolean; // default true
}

interface Props extends ConfirmOptions {
  open: boolean;
  onResult: (confirmed: boolean) => void;
}

/**
 * A16 shared confirmation for destructive actions (Radix AlertDialog: focus trap, Esc = cancel,
 * focus starts on Cancel). Buttons stack full-width under 640px with 44px targets.
 */
export function ConfirmDialog({ open, title, description, confirmLabel, destructive = true, onResult }: Props) {
  const tc = useTranslations("common");
  return (
    <AlertDialog open={open} onOpenChange={(next) => !next && onResult(false)}>
      <AlertDialogContent>
        <div className="flex flex-col gap-1.5">
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description ? <AlertDialogDescription>{description}</AlertDialogDescription> : null}
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <AlertDialogCancel className={cn(buttonVariants({ variant: "outline" }), "hit-target w-full sm:w-auto")}>
            {tc("cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => onResult(true)}
            className={cn(
              buttonVariants({ variant: "default" }),
              "hit-target w-full sm:w-auto",
              destructive && "bg-destructive text-background hover:bg-destructive/90 focus-visible:ring-destructive/40",
            )}
          >
            {confirmLabel}
          </AlertDialogAction>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
