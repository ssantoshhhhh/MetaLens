import { ApiError } from "@/server/errors"
import { apiRoute, ensureOwnerCookie, getPrincipal } from "@/server/http"
import { runAnalysis } from "@/server/services/pipeline"
import { readLimitedFormData } from "@/server/services/upload"
import { saveAnalysis } from "@/server/store"

export const POST = apiRoute(
  async (request) => {
    const form = await readLimitedFormData(request)
    const file = form.get("file")
    if (!(file instanceof File)) {
      throw new ApiError(
        400,
        "missing_file",
        "Attach an image in the file field.",
      )
    }
    const lastModified = Number(form.get("lastModified"))
    const principal = getPrincipal(request)
    const saveToHistory = form.get("saveToHistory") === "true"
    if (saveToHistory && !principal.userId) {
      throw new ApiError(
        401,
        "auth_required",
        "Sign in to save analyses to history.",
      )
    }

    const { analysis, preview } = await runAnalysis({
      bytes: new Uint8Array(await file.arrayBuffer()),
      filename: file.name,
      declaredMime: file.type,
      clientLastModified: lastModified > 0 ? lastModified : null,
    })
    const { ownerKey, cookie } = ensureOwnerCookie(request, principal)
    const saved = await saveAnalysis(
      analysis,
      ownerKey,
      principal.userId,
      saveToHistory,
    )
    const response = Response.json(
      { analysis: saved, preview },
      { status: 201 },
    )
    if (cookie) response.headers.append("Set-Cookie", cookie)
    return response
  },
  { rateLimit: { name: "analyze", limit: 20, windowMs: 60_000 } },
)
