import { connection, type NextRequest } from "next/server"
import { ApiError } from "@/server/errors"
import { enforceRateLimit, type RateLimit } from "@/server/rate-limit"
import {
  isUuid,
  newOwnerKey,
  OWNER_COOKIE,
  SESSION_COOKIE,
  verifySessionToken,
} from "@/server/auth/session"

export type Principal = { ownerKey: string | null; userId: string | null }

export function getPrincipal(request: NextRequest): Principal {
  const owner = request.cookies.get(OWNER_COOKIE)?.value
  return {
    ownerKey: owner && isUuid(owner) ? owner : null,
    userId: verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value),
  }
}

export function isSecureRequest(request: NextRequest) {
  const proto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim()
  return (proto ?? request.nextUrl.protocol.replace(":", "")) === "https"
}

export function cookieAttributes(request: NextRequest, maxAge: number) {
  const secure = isSecureRequest(request) ? "; Secure" : ""
  return `Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`
}

export function ensureOwnerCookie(request: NextRequest, principal: Principal) {
  if (principal.ownerKey) return { ownerKey: principal.ownerKey, cookie: null }
  const ownerKey = newOwnerKey()
  return {
    ownerKey,
    cookie: `${OWNER_COOKIE}=${ownerKey}; ${cookieAttributes(request, 60 * 60 * 24)}`,
  }
}

function assertSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin")
  if (!origin) return
  const host =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host")
  let originHost: string | null = null
  try {
    originHost = new URL(origin).host
  } catch {
    // An unparseable Origin is rejected below.
  }
  if (originHost !== host) {
    throw new ApiError(
      403,
      "forbidden_origin",
      "Cross-origin request rejected.",
    )
  }
}

export function assertId(id: string) {
  if (!isUuid(id)) throw new ApiError(400, "invalid_id", "Invalid analysis ID.")
}

export function errorResponse(error: unknown) {
  if (error instanceof ApiError) {
    return Response.json(
      { error: { code: error.code, message: error.message } },
      {
        status: error.status,
        headers: { "Cache-Control": "no-store", ...error.headers },
      },
    )
  }
  // Only the error type is logged, because messages may include metadata or paths.
  console.error(
    "Unhandled API error:",
    error instanceof Error ? error.name : "unknown",
  )
  return Response.json(
    { error: { code: "internal_error", message: "Something went wrong." } },
    { status: 500, headers: { "Cache-Control": "no-store" } },
  )
}

type Options = { rateLimit?: RateLimit }

/** Wraps a handler with origin checks, rate limiting, no-store, and safe errors. */
export function apiRoute<Context>(
  handler: (request: NextRequest, context: Context) => Promise<Response>,
  options: Options = {},
) {
  return async (request: NextRequest, context: Context) => {
    // Outside the try block so Next.js can handle its own prerender signal.
    await connection()
    try {
      if (request.method !== "GET" && request.method !== "HEAD") {
        assertSameOrigin(request)
      }
      if (options.rateLimit)
        enforceRateLimit(options.rateLimit, request.headers)
      const response = await handler(request, context)
      if (!response.headers.has("Cache-Control")) {
        response.headers.set("Cache-Control", "no-store")
      }
      return response
    } catch (error) {
      return errorResponse(error)
    }
  }
}
