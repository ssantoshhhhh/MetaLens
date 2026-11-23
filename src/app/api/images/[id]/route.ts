import { apiRoute, assertId, getPrincipal } from "@/server/http"
import { deleteAnalysis, getAnalysis } from "@/server/store"

type Context = RouteContext<"/api/images/[id]">
const rateLimit = { name: "read", limit: 120, windowMs: 60_000 }

export const GET = apiRoute<Context>(
  async (request, context) => {
    const { id } = await context.params
    assertId(id)
    return Response.json({
      analysis: await getAnalysis(id, getPrincipal(request)),
    })
  },
  { rateLimit },
)

export const DELETE = apiRoute<Context>(
  async (request, context) => {
    const { id } = await context.params
    assertId(id)
    await deleteAnalysis(id, getPrincipal(request))
    return new Response(null, { status: 204 })
  },
  { rateLimit },
)
