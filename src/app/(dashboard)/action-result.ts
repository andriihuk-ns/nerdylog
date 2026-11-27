import { unstable_rethrow } from "next/navigation";
import { getTranslations } from "next-intl/server";

/** Typed result every dashboard server action returns. Never throws to the client. */
export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; message: string };

export function ok(): ActionResult;
export function ok<T>(data: T): ActionResult<T>;
export function ok<T>(data?: T): ActionResult<T | undefined> {
  return { ok: true, data };
}

/** A failed result with copy in the caller's locale (A14). */
export function fail(message: string): { ok: false; message: string } {
  return { ok: false, message };
}

/**
 * Service errors → readable messages in the request locale. Matched by `name` because
 * ForbiddenError exists in both services/errors.ts and auth/session.ts. Next.js control-flow
 * errors (redirect) rethrow. InvalidInputError details come from services and stay as written.
 */
export async function actionError(err: unknown): Promise<{ ok: false; message: string }> {
  unstable_rethrow(err);
  const t = await getTranslations("errors");
  const name = err instanceof Error ? err.name : "";
  const detail = err instanceof Error ? err.message : "";
  switch (name) {
    case "ForbiddenError":
      return fail(t("forbidden"));
    case "NotFoundError":
      return fail(t("notFound"));
    case "InvalidInputError":
    case "ZodError":
      return fail(detail && detail.length <= 140 ? detail : t("invalid"));
    default:
      console.error("server action failed", detail || err);
      return fail(t("generic"));
  }
}

/** First InvalidInputError code for `field` (e.g. projectId → "not_member"); matched by name. */
export function fieldErrorCode(err: unknown, field: string): string | null {
  if (!(err instanceof Error) || err.name !== "InvalidInputError") return null;
  const fieldErrors = (err as Error & { fieldErrors?: Record<string, string[] | undefined> }).fieldErrors;
  return fieldErrors?.[field]?.[0] ?? null;
}
