import { ApiError } from "@/server/errors"
import { apiRoute } from "@/server/http"
import { sanitizeForVision } from "@/server/services/image"
import { readLimitedFormData } from "@/server/services/upload"
import { describeImage, isVisionEnabled } from "@/server/services/vision"

const MAX_PREVIEW_BYTES = 3 * 1024 * 1024

const invalidPreview = () =>
  new ApiError(400, "invalid_preview", "A valid image preview is required.")

/** Describes the preview of a temporary analysis held in the browser. */
export const POST = apiRoute(
  async (request) => {
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
      throw invalidPreview()
    }
    let jpeg: Buffer
    try {
      jpeg = await sanitizeForVision(
        new Uint8Array(await preview.arrayBuffer()),
      )
    } catch {
      throw invalidPreview()
    }
    return Response.json({ vision: await describeImage(jpeg) })
  },
  { rateLimit: { name: "vision", limit: 5, windowMs: 60_000 } },
)
