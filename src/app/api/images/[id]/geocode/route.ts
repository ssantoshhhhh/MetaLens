import { ApiError } from "@/server/errors"
import { apiRoute, assertId, getPrincipal } from "@/server/http"
import { reverseGeocode } from "@/server/services/location"
import { getAnalysis, updateAnalysis } from "@/server/store"

export const POST = apiRoute<RouteContext<"/api/images/[id]/geocode">>(
  async (request, context) => {
    const { id } = await context.params
    assertId(id)
    const principal = getPrincipal(request)
    const analysis = await getAnalysis(id, principal)
    const { latitude, longitude, place: existing } = analysis.location
    if (latitude === null || longitude === null) {
      throw new ApiError(
        422,
        "no_gps",
        "This image has no embedded GPS coordinates.",
      )
    }
    if (existing) return Response.json({ place: existing })
    const place = await reverseGeocode(latitude, longitude)
    await updateAnalysis(id, principal, (current) => ({
      ...current,
      location: { ...current.location, place },
    }))
    return Response.json({ place })
  },
  { rateLimit: { name: "geocode", limit: 10, windowMs: 60_000 } },
)
