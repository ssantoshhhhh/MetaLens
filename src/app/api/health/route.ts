import { isAuthEnabled } from "@/server/auth/session"
import { apiRoute } from "@/server/http"
import { exiftoolVersion } from "@/server/services/metadata/exiftool"
import { isVisionEnabled } from "@/server/services/vision"

export const GET = apiRoute(async () => {
  const features = { history: isAuthEnabled(), ai: isVisionEnabled() }
  try {
    const exiftool = await exiftoolVersion()
    return Response.json({ status: "ok", exiftool, features })
  } catch {
    return Response.json(
      { status: "degraded", exiftool: null, features },
      { status: 503 },
    )
  }
})
