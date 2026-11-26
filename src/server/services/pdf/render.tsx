import { renderToBuffer } from "@react-pdf/renderer";
import { ReportDocument } from "./report-document";
import type { ReportModel } from "./report-model";

/** Renders the report to PDF bytes (Node runtime only). */
export async function renderReportPdf(model: ReportModel): Promise<Uint8Array> {
  const buffer = await renderToBuffer(<ReportDocument model={model} />);
  return new Uint8Array(buffer);
}
