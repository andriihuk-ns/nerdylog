import type { Metadata } from "next";
import { Suspense } from "react";
import { AlertCircle } from "lucide-react";
import { NerdylogLogo } from "@/components/brand/nerdylog-logo";
import { loginErrorMessage, signInHref } from "@/components/shell/login-errors";

export const metadata: Metadata = { title: "Sign in" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Figma "Visible · 1440 · Light" (node 1:42): centred wordmark, tagline, one Slack button. */
export default function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <main className="flex min-h-dvh flex-1 flex-col items-center justify-center gap-10 bg-card px-4 py-12">
      <div className="flex w-[297px] max-w-full flex-col items-center gap-2.5">
        <h1 className="text-foreground">
          <NerdylogLogo height={40} />
        </h1>
        <p className="text-center text-sm leading-5 text-muted-foreground">
          Log time and share your standup from Slack. Sign in with your workspace account
        </p>
      </div>
      <Suspense fallback={<SignInButton href="/auth/sign-in" />}>
        <LoginActions searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function LoginActions({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const error = loginErrorMessage(params.error);
  return (
    <div className="flex w-[318px] max-w-full flex-col gap-3">
      {error ? (
        <div role="alert" className="flex gap-2 rounded-[10px] bg-pto-subtle p-3 text-sm text-pto">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>{error}</p>
        </div>
      ) : null}
      <SignInButton href={signInHref(params.next)} />
    </div>
  );
}

function SignInButton({ href }: { href: string }) {
  return (
    // Plain <a>: /auth/sign-in is a route handler that redirects to Slack.
    <a
      href={href}
      className="flex h-11 w-[318px] max-w-full items-center justify-center gap-1.5 rounded-[10px] border bg-card px-[11px] text-sm leading-5 font-medium text-foreground shadow-[0_0.1px_2px_rgba(0,0,0,0.1)] transition-colors duration-[var(--duration-base)] ease-spring hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <span className="flex size-5 shrink-0 items-center justify-center" aria-hidden>
        {/* eslint-disable-next-line @next/next/no-img-element -- static multicolour mark from the design */}
        <img src="/brand/slack.svg" alt="" width={16.25} height={16.25} />
      </span>
      Sign in with Slack
    </a>
  );
}
