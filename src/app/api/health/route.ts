import { isAuthEnabled } from "@/server/auth/session"
import { apiRoute } from "@/server/http"
import { isVisionEnabled } from "@/server/services/vision"

export const GET = apiRoute(async () =>
  Response.json({
    status: "ok",
    extraction: "browser",
    features: { history: isAuthEnabled(), ai: isVisionEnabled() },
  }),
)
