"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export interface NavItem {
  href: string;
  label: string;
}

export function NavLinks({ items, label }: { items: NavItem[]; label: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label={label} className="flex items-center gap-1">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "hit-target inline-flex items-center rounded-md px-3 font-medium text-muted-foreground transition-colors duration-[var(--duration-fast)] ease-standard hover:text-foreground",
              active && "text-foreground",
            )}
          >
            <span className={cn("border-b-2 border-transparent py-1", active && "border-foreground")}>
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
