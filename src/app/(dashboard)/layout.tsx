import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { ShellNav, ShellNavSkeleton } from "@/components/shell/shell-nav";

/**
 * Static shell + nav. ShellNav calls requireActor() (redirects signed-out users) inside
 * Suspense, as Cache Components requires for session reads. Every page and action also
 * calls requireActor() itself; the layout is not the security boundary.
 */
export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex h-14 w-full max-w-[1280px] items-center gap-6 px-4 sm:px-6">
          <Link href="/my-time" className="text-base font-semibold tracking-[-0.01em]">
            Tempo
          </Link>
          <Suspense fallback={<ShellNavSkeleton />}>
            <ShellNav />
          </Suspense>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
