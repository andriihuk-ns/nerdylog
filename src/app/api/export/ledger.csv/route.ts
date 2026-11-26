import type { NextRequest } from "next/server";
import { z } from "zod";
import { isoDateSchema } from "@/contracts";
import { requireActor } from "@/server/auth/session";
import { buildLedgerCsv } from "@/server/services/export-service";
import { errorResponse, fileResponse, listParam, parseQuery } from "../_lib/http";

const querySchema = z.object({
  from: isoDateSchema,
  to: isoDateSchema,
  userIds: z.array(z.uuid()).optional(),
  projectIds: z.array(z.uuid()).optional(),
});

/** GET /api/export/ledger.csv?from&to&userIds&projectIds — Detailed Ledger CSV (FR-EXP-01). */
export async function GET(request: NextRequest) {
  try {
    const actor = await requireActor();
    const params = request.nextUrl.searchParams;
    const query = parseQuery(querySchema, {
      from: params.get("from") ?? undefined,
      to: params.get("to") ?? undefined,
      userIds: listParam(params, "userIds"),
      projectIds: listParam(params, "projectIds"),
    });
    return fileResponse(await buildLedgerCsv(actor, query));
  } catch (error) {
    return errorResponse(error, "export/ledger.csv");
  }
}
