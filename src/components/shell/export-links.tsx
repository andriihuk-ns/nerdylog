import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface ExportLink {
  label: string;
  href: string;
}

/** Plain download links to /api/export/** route handlers (Backend-owned). */
export function ExportLinks({ links }: { links: ExportLink[] }) {
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Export">
      {links.map((l) => (
        <Button key={l.href} asChild variant="outline" className="hit-target">
          <a href={l.href} download>
            <Download aria-hidden />
            {l.label}
          </a>
        </Button>
      ))}
    </div>
  );
}

export function exportHref(path: string, params: Record<string, string>): string {
  return `${path}?${new URLSearchParams(params).toString()}`;
}
