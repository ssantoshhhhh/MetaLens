import { safeDownloadName } from "@/lib/format"
import { ApiError } from "@/server/errors"
import { apiRoute, assertId, getPrincipal } from "@/server/http"
import {
  REPORT_FORMATS,
  toCsv,
  toJsonReport,
  toPdf,
  type ReportFormat,
} from "@/server/services/report"
import { getAnalysis } from "@/server/store"

const CONTENT_TYPES: Record<ReportFormat, string> = {
  json: "application/json; charset=utf-8",
  csv: "text/csv; charset=utf-8",
  pdf: "application/pdf",
}

export const GET = apiRoute<RouteContext<"/api/images/[id]/report">>(
  async (request, context) => {
    const { id } = await context.params
    assertId(id)
    const format = request.nextUrl.searchParams.get(
      "format",
    ) as ReportFormat | null
    if (!format || !REPORT_FORMATS.includes(format)) {
      throw new ApiError(400, "invalid_format", "Use format=json, csv, or pdf.")
    }
    const analysis = await getAnalysis(id, getPrincipal(request))
    const body =
      format === "json"
        ? toJsonReport(analysis)
        : format === "csv"
          ? toCsv(analysis)
          : new Uint8Array(await toPdf(analysis))
    const name = safeDownloadName(
      analysis.file.originalFilename,
      `report.${format}`,
    )
    return new Response(body, {
      headers: {
        "Content-Type": CONTENT_TYPES[format],
        "Content-Disposition": `attachment; filename="${name}"`,
      },
    })
  },
  { rateLimit: { name: "report", limit: 30, windowMs: 60_000 } },
)
