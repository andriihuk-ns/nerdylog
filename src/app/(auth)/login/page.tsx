import type { Metadata } from "next";
import { Suspense } from "react";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SlackMark } from "@/components/shell/slack-mark";
import { loginErrorMessage, signInHref } from "@/components/shell/login-errors";

export const metadata: Metadata = { title: "Sign in" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12 sm:px-6">
      <div className="w-full max-w-sm rounded-lg border bg-card p-8">
        <p className="text-2xl font-semibold tracking-[-0.01em]">Tempo</p>
        <p className="mt-2 text-muted-foreground">
          Log time and share your standup from Slack. Sign in with your workspace account.
        </p>
        <Suspense fallback={<SignInButton href="/auth/sign-in" />}>
          <LoginActions searchParams={searchParams} />
        </Suspense>
      </div>
    </main>
  );
}

async function LoginActions({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const error = loginErrorMessage(params.error);
  return (
    <>
      {error ? (
        <div role="alert" className="mt-6 flex gap-2 rounded-md bg-pto-subtle p-3 text-pto">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>{error}</p>
        </div>
      ) : null}
      <SignInButton href={signInHref(params.next)} />
    </>
  );
}

function SignInButton({ href }: { href: string }) {
  return (
    <Button asChild size="lg" className="hit-target mt-6 w-full text-sm">
      {/* Plain <a>: /auth/sign-in is a route handler that redirects to Slack. */}
      <a href={href}>
        <SlackMark className="size-4" />
        Sign in with Slack
      </a>
    </Button>
  );
}
