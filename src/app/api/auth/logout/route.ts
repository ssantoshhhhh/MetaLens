import { clearSessionCookie } from "@/server/auth/service"
import { apiRoute } from "@/server/http"

export const POST = apiRoute(async (request) => {
  const response = new Response(null, { status: 204 })
  response.headers.append("Set-Cookie", clearSessionCookie(request))
  return response
})
