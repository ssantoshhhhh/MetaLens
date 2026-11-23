import { isAuthEnabled } from "@/server/auth/session"
import { ApiError } from "@/server/errors"
import { apiRoute, getPrincipal } from "@/server/http"
import { listHistory } from "@/server/store"

export const GET = apiRoute(async (request) => {
  const { userId } = getPrincipal(request)
  if (!isAuthEnabled())
    throw new ApiError(503, "history_disabled", "History is not configured.")
  if (!userId)
    throw new ApiError(401, "auth_required", "Sign in to view history.")
  const items = await listHistory(
    userId,
    request.nextUrl.searchParams.get("q") ?? "",
  )
  return Response.json({ items })
})
