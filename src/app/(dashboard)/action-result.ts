import { unstable_rethrow } from "next/navigation";

/** Typed result every dashboard server action returns. Never throws to the client. */
export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; message: string };

export function ok(): ActionResult;
export function ok<T>(data: T): ActionResult<T>;
export function ok<T>(data?: T): ActionResult<T | undefined> {
  return { ok: true, data };
}

/**
 * Service errors → readable messages. Matched by `name` because ForbiddenError exists in
 * both services/errors.ts and auth/session.ts. Next.js control-flow errors (redirect) rethrow.
 */
export function actionError(err: unknown): { ok: false; message: string } {
  unstable_rethrow(err);
  const name = err instanceof Error ? err.name : "";
  const detail = err instanceof Error ? err.message : "";
  switch (name) {
    case "ForbiddenError":
      return { ok: false, message: "You don't have permission to do that." };
    case "NotFoundError":
      return { ok: false, message: "That item no longer exists. Refresh and try again." };
    case "InvalidInputError":
    case "ZodError":
      return { ok: false, message: detail && detail.length <= 140 ? detail : "Check the values and try again." };
    default:
      console.error("server action failed", detail || err);
      return { ok: false, message: "Something went wrong. Try again." };
  }
}
