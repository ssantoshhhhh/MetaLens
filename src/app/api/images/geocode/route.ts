import { ApiError } from "@/server/errors"
import { apiRoute } from "@/server/http"
import { reverseGeocode } from "@/server/services/location"
import { readLimitedJson } from "@/server/services/upload"

/** Looks up a place for a temporary analysis held in the browser. */
export const POST = apiRoute(
  async (request) => {
    const body = (await readLimitedJson(request, 1024)) as {
      latitude?: unknown
      longitude?: unknown
    } | null
    const { latitude, longitude } = body ?? {}
    if (
      typeof latitude !== "number" ||
      typeof longitude !== "number" ||
      Math.abs(latitude) > 90 ||
      Math.abs(longitude) > 180
    ) {
      throw new ApiError(422, "no_gps", "Valid GPS coordinates are required.")
    }
    return Response.json({ place: await reverseGeocode(latitude, longitude) })
  },
  { rateLimit: { name: "geocode", limit: 10, windowMs: 60_000 } },
)
