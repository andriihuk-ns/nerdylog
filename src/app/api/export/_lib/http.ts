import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import type { ExportFile } from "@/contracts";
import { ForbiddenError as RoleForbiddenError } from "@/server/auth/session";
import { ForbiddenError, InvalidInputError, NotFoundError } from "@/server/services/errors";
import { zodFieldErrors } from "@/server/services/validation";

/** Shared helpers for /api/export/* route handlers (private folder, not routable). */

/** Comma-separated and/or repeated params: `?userIds=a,b&userIds=c` → ["a","b","c"]; none → undefined. */
export function listParam(params: URLSearchParams, name: string): string[] | undefined {
  const values = params
    .getAll(name)
    .flatMap((v) => v.split(","))
    .map((v) => v.trim())
    .filter(Boolean);
  return values.length > 0 ? values : undefined;
}

/** Validate query params or throw InvalidInputError (→ 400). */
export function parseQuery<S extends z.ZodType>(schema: S, value: unknown): z.output<S> {
  const result = schema.safeParse(value);
  if (!result.success) throw new InvalidInputError(zodFieldErrors(result.error));
  return result.data;
}

export function fileResponse(file: ExportFile): Response {
  const asciiName = file.filename.replace(/[^\w.-]/g, "_");
  return new Response(new Blob([file.body as Uint8Array<ArrayBuffer>], { type: file.contentType }), {
    status: 200,
    headers: {
      "Content-Type": file.contentType,
      "Content-Disposition": `attachment; filename="${asciiName}"`,
      "Content-Length": String(file.body.byteLength),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

/**
 * Maps service errors to HTTP. Next.js control-flow errors (requireActor's redirect to
 * /login) are rethrown. Unknown errors → 500 without internals in the body.
 */
export function errorResponse(error: unknown, route: string): Response {
  unstable_rethrow(error);
  if (error instanceof ForbiddenError || error instanceof RoleForbiddenError) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }
  if (error instanceof InvalidInputError) {
    return Response.json({ error: "invalid_input", fieldErrors: error.fieldErrors }, { status: 400 });
  }
  if (error instanceof RangeError) {
    return Response.json({ error: "invalid_range", message: error.message }, { status: 400 });
  }
  if (error instanceof NotFoundError) return Response.json({ error: "not_found" }, { status: 404 });
  console.error(`${route} failed`, error instanceof Error ? error.message : error);
  return Response.json({ error: "internal_error" }, { status: 500 });
}
