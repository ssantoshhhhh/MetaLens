import { ApiError } from "@/server/errors"
import { apiRoute, assertId, getPrincipal } from "@/server/http"
import { sanitizeForVision } from "@/server/services/image"
import { readLimitedFormData } from "@/server/services/upload"
import { describeImage, isVisionEnabled } from "@/server/services/vision"
import { getAnalysis, updateAnalysis } from "@/server/store"

const MAX_PREVIEW_BYTES = 4 * 1024 * 1024

export const POST = apiRoute<RouteContext<"/api/images/[id]/vision">>(
  async (request, context) => {
    const { id } = await context.params
    assertId(id)
    const principal = getPrincipal(request)
    await getAnalysis(id, principal)
    if (!isVisionEnabled()) {
      throw new ApiError(
        503,
        "ai_disabled",
        "AI analysis is not configured on this server.",
      )
    }
    const form = await readLimitedFormData(request, MAX_PREVIEW_BYTES)
    const preview = form.get("preview")
    if (!(preview instanceof File) || preview.size > MAX_PREVIEW_BYTES) {
      throw new ApiError(
        400,
        "invalid_preview",
        "A valid image preview is required.",
      )
    }
    let jpeg: Buffer
    try {
      jpeg = await sanitizeForVision(
        new Uint8Array(await preview.arrayBuffer()),
      )
    } catch {
      throw new ApiError(
        400,
        "invalid_preview",
        "A valid image preview is required.",
      )
    }
    const vision = await describeImage(jpeg)
    await updateAnalysis(id, principal, (current) => ({ ...current, vision }))
    return Response.json({ vision })
  },
  { rateLimit: { name: "vision", limit: 5, windowMs: 60_000 } },
)
