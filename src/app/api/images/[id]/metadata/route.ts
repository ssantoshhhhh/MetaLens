import { safeDownloadName } from "@/lib/format"
import { apiRoute, assertId, getPrincipal } from "@/server/http"
import { getAnalysis } from "@/server/store"

export const GET = apiRoute<RouteContext<"/api/images/[id]/metadata">>(
  async (request, context) => {
    const { id } = await context.params
    assertId(id)
    const analysis = await getAnalysis(id, getPrincipal(request))
    const body = {
      id,
      fieldCount: analysis.fields.length,
      fields: analysis.fields,
      raw: analysis.raw,
    }
    if (request.nextUrl.searchParams.get("download") !== "1")
      return Response.json(body)
    const name = safeDownloadName(
      analysis.file.originalFilename,
      "metadata.json",
    )
    return new Response(JSON.stringify(body, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${name}"`,
      },
    })
  },
  { rateLimit: { name: "read", limit: 120, windowMs: 60_000 } },
)
