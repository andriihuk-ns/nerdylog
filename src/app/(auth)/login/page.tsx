import type { Metadata } from "next";
import { Suspense } from "react";
import { AlertCircle } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { AnimatedLogo } from "@/components/brand/animated-logo";
import { LocaleSwitcher } from "@/components/shell/locale-switcher";
import { loginErrorKey, signInHref } from "@/components/shell/login-errors";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadata");
  return { title: t("signIn") };
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Figma "Visible · 1440 · Light" (node 1:42): centred wordmark, tagline, one Slack button. A14: language switch top-right. */
export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const t = await getTranslations("login");
  return (
    <main className="relative flex min-h-dvh flex-1 flex-col items-center justify-center gap-10 bg-card px-4 py-12">
      <LocaleSwitcher className="login-fade absolute top-4 right-4 sm:top-6 sm:right-6" />
      <div className="flex w-[297px] max-w-full flex-col items-center gap-2.5">
        <h1 className="text-foreground">
          <AnimatedLogo height={40} />
        </h1>
        <p className="login-tagline text-center text-sm leading-5 text-muted-foreground">{t("tagline")}</p>
      </div>
      {/* The wrapper animates, so the Suspense swap does not replay the entrance. */}
      <div className="login-actions">
        <Suspense fallback={<SignInButton href="/auth/sign-in" label={t("signIn")} />}>
          <LoginActions searchParams={searchParams} />
        </Suspense>
      </div>
    </main>
  );
}

async function LoginActions({ searchParams }: { searchParams: SearchParams }) {
  const [params, t] = await Promise.all([searchParams, getTranslations("login")]);
  const error = loginErrorKey(params.error);
  return (
    <div className="flex w-[318px] max-w-full flex-col gap-3">
      {error ? (
        <div role="alert" className="flex gap-2 rounded-[10px] bg-pto-subtle p-3 text-sm text-pto">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>{t(`errors.${error}`)}</p>
        </div>
      ) : null}
      <SignInButton href={signInHref(params.next)} label={t("signIn")} />
    </div>
  );
}

function SignInButton({ href, label }: { href: string; label: string }) {
  return (
    // Plain <a>: /auth/sign-in is a route handler that redirects to Slack.
    <a
      href={href}
      className={cn(buttonVariants(), "h-11 w-[318px] max-w-full")}
    >
      <span className="flex size-5 shrink-0 items-center justify-center" aria-hidden>
        {/* eslint-disable-next-line @next/next/no-img-element -- static multicolour mark from the design */}
        <img src="/brand/slack.svg" alt="" width={16.25} height={16.25} />
      </span>
      {label}
    </a>
  );
}
