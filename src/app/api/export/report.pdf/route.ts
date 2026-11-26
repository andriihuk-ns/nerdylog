import type { NextRequest } from "next/server";
import { z } from "zod";
import { isoDateSchema } from "@/contracts";
import { requireActor } from "@/server/auth/session";
import { buildReportPdf } from "@/server/services/export-service";
import { errorResponse, fileResponse, listParam, parseQuery } from "../_lib/http";

const querySchema = z.object({
  from: isoDateSchema,
  to: isoDateSchema,
  userIds: z.array(z.uuid()).optional(),
});

/** GET /api/export/report.pdf?from&to&userIds — PDF report (FR-EXP-02). Node runtime (react-pdf). */
export async function GET(request: NextRequest) {
  try {
    const actor = await requireActor();
    const params = request.nextUrl.searchParams;
    const query = parseQuery(querySchema, {
      from: params.get("from") ?? undefined,
      to: params.get("to") ?? undefined,
      userIds: listParam(params, "userIds"),
    });
    return fileResponse(await buildReportPdf(actor, query));
  } catch (error) {
    return errorResponse(error, "export/report.pdf");
  }
}
