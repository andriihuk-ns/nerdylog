import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireActor } from "@/server/auth/session";
import { buildSummaryCsv } from "@/server/services/export-service";
import { errorResponse, fileResponse, parseQuery } from "../_lib/http";

const querySchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Expected YYYY-MM"),
});

/** GET /api/export/summary.csv?month=YYYY-MM — Monthly Summary Pivot CSV (FR-EXP-01). */
export async function GET(request: NextRequest) {
  try {
    const actor = await requireActor();
    const { month } = parseQuery(querySchema, { month: request.nextUrl.searchParams.get("month") ?? undefined });
    return fileResponse(await buildSummaryCsv(actor, month));
  } catch (error) {
    return errorResponse(error, "export/summary.csv");
  }
}
