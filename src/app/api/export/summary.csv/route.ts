import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireActor } from "@/server/auth/session";
import { buildSummaryCsv } from "@/server/services/export-service";
import { errorResponse, fileResponse, listParam, parseQuery } from "../_lib/http";

const querySchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Expected YYYY-MM"),
  projectIds: z.array(z.uuid()).optional(),
});

/** GET /api/export/summary.csv?month=YYYY-MM&projectIds — Monthly Summary Pivot CSV (FR-EXP-01). */
export async function GET(request: NextRequest) {
  try {
    const actor = await requireActor();
    const params = request.nextUrl.searchParams;
    const query = parseQuery(querySchema, {
      month: params.get("month") ?? undefined,
      projectIds: listParam(params, "projectIds"),
    });
    return fileResponse(await buildSummaryCsv(actor, query.month, query.projectIds));
  } catch (error) {
    return errorResponse(error, "export/summary.csv");
  }
}
