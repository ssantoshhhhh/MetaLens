import {
  loginUser,
  readCredentials,
  sessionCookie,
} from "@/server/auth/service"
import { apiRoute } from "@/server/http"

export const POST = apiRoute(
  async (request) => {
    const user = await loginUser(await readCredentials(request))
    const response = Response.json({ user }, { status: 200 })
    response.headers.append("Set-Cookie", sessionCookie(request, user.id))
    return response
  },
  { rateLimit: { name: "auth", limit: 10, windowMs: 60_000 } },
)
