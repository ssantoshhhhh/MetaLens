import { isAuthEnabled } from "@/server/auth/session"
import { apiRoute, getPrincipal } from "@/server/http"
import { isVisionEnabled } from "@/server/services/vision"
import { db } from "@/server/store"
import type { SessionState } from "@/types/analysis"

export const GET = apiRoute(async (request) => {
  const authEnabled = isAuthEnabled()
  const { userId } = getPrincipal(request)
  const user =
    authEnabled && userId
      ? await db().user.findUnique({
          where: { id: userId },
          select: { id: true, name: true, email: true },
        })
      : null
  return Response.json({
    authEnabled,
    aiEnabled: isVisionEnabled(),
    user,
  } satisfies SessionState)
})
