import { ApiError } from "@/server/errors"
import { apiRoute, getPrincipal } from "@/server/http"
import { runAnalysis } from "@/server/services/pipeline"
import { readLimitedJson } from "@/server/services/upload"
import { saveAnalysis } from "@/server/store"

/** Stays below Vercel's 4.5 MB function payload limit. */
const MAX_BODY_BYTES = 4 * 1024 * 1024
const MAX_HEADER_BYTES = 64

const invalid = () =>
  new ApiError(400, "invalid_request", "The metadata request is invalid.")

export const POST = apiRoute(
  async (request) => {
    const body = (await readLimitedJson(request, MAX_BODY_BYTES)) as Record<
      string,
      unknown
    > | null
    const record = body?.record
    if (
      !body ||
      typeof record !== "object" ||
      record === null ||
      Array.isArray(record) ||
      typeof body.filename !== "string" ||
      typeof body.tempName !== "string" ||
      typeof body.mimeType !== "string" ||
      typeof body.header !== "string" ||
      typeof body.size !== "number" ||
      !Number.isSafeInteger(body.size) ||
      body.size < 0
    ) {
      throw invalid()
    }
    const header = new Uint8Array(Buffer.from(body.header, "base64"))
    if (header.byteLength > MAX_HEADER_BYTES) throw invalid()

    const principal = getPrincipal(request)
    const saveToHistory = body.saveToHistory === true
    if (saveToHistory && !principal.userId) {
      throw new ApiError(
        401,
        "auth_required",
        "Sign in to save analyses to history.",
      )
    }
    const lastModified = Number(body.lastModified)
    const analysis = runAnalysis({
      record: record as Record<string, unknown>,
      tempName: body.tempName,
      header,
      size: body.size,
      filename: body.filename,
      declaredMime: body.mimeType,
      clientLastModified: lastModified > 0 ? lastModified : null,
      decoded: body.decoded === true,
    })
    const saved = await saveAnalysis(analysis, principal.userId, saveToHistory)
    return Response.json({ analysis: saved }, { status: 201 })
  },
  { rateLimit: { name: "analyze", limit: 20, windowMs: 60_000 } },
)
