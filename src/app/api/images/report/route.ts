import { safeDownloadName } from "@/lib/format"
import { ApiError } from "@/server/errors"
import { apiRoute } from "@/server/http"
import {
  REPORT_FORMATS,
  toCsv,
  toJsonReport,
  toPdf,
  type ReportFormat,
} from "@/server/services/report"
import { readLimitedJson } from "@/server/services/upload"
import type { ImageAnalysis } from "@/types/analysis"

const MAX_BODY_BYTES = 4 * 1024 * 1024
const CONTENT_TYPES: Record<ReportFormat, string> = {
  json: "application/json; charset=utf-8",
  csv: "text/csv; charset=utf-8",
  pdf: "application/pdf",
}

/** Builds a report for a temporary analysis held in the browser. Nothing is stored. */
export const POST = apiRoute(
  async (request) => {
    const format = request.nextUrl.searchParams.get(
      "format",
    ) as ReportFormat | null
    if (!format || !REPORT_FORMATS.includes(format)) {
      throw new ApiError(400, "invalid_format", "Use format=json, csv, or pdf.")
    }
    const payload = (await readLimitedJson(request, MAX_BODY_BYTES)) as {
      analysis?: ImageAnalysis
    } | null
    const analysis = payload?.analysis
    let body: string | Uint8Array<ArrayBuffer>
    try {
      if (!analysis || !Array.isArray(analysis.fields)) throw new Error()
      body =
        format === "json"
          ? toJsonReport(analysis)
          : format === "csv"
            ? toCsv(analysis)
            : new Uint8Array(await toPdf(analysis))
    } catch {
      throw new ApiError(400, "invalid_request", "The analysis is invalid.")
    }
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
