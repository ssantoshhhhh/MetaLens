import type { NextRequest } from "next/server"
import {
  createSessionToken,
  hashPassword,
  isAuthEnabled,
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  verifyPassword,
} from "@/server/auth/session"
import { ApiError } from "@/server/errors"
import { cookieAttributes } from "@/server/http"
import { db } from "@/server/store"

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
// Verified for unknown emails so response time does not reveal whether an account exists.
const dummyHash = hashPassword("metalens-timing-placeholder")

export type Credentials = { name?: string; email: string; password: string }

export async function readCredentials(
  request: NextRequest,
): Promise<Credentials> {
  if (!isAuthEnabled())
    throw new ApiError(503, "auth_disabled", "Accounts are not configured.")
  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    throw new ApiError(400, "invalid_request", "Expected a JSON body.")
  }
  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : ""
  const password = typeof body.password === "string" ? body.password : ""
  const name =
    typeof body.name === "string" ? body.name.trim().slice(0, 80) : undefined
  if (!EMAIL.test(email) || email.length > 254) {
    throw new ApiError(400, "invalid_email", "Enter a valid email address.")
  }
  if (password.length > 200)
    throw new ApiError(400, "invalid_password", "Password is too long.")
  return { name, email, password }
}

export async function registerUser({ name, email, password }: Credentials) {
  if (!name) throw new ApiError(400, "invalid_name", "Enter your name.")
  if (password.length < 10) {
    throw new ApiError(400, "invalid_password", "Use at least 10 characters.")
  }
  const passwordHash = await hashPassword(password)
  try {
    return await db().user.create({
      data: { name, email, passwordHash },
      select: { id: true, name: true, email: true },
    })
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") {
      throw new ApiError(
        409,
        "email_taken",
        "An account with this email already exists.",
      )
    }
    throw error
  }
}

export async function loginUser({ email, password }: Credentials) {
  const user = await db().user.findUnique({ where: { email } })
  const valid = await verifyPassword(
    password,
    user?.passwordHash ?? (await dummyHash),
  )
  if (!user || !valid)
    throw new ApiError(
      401,
      "invalid_credentials",
      "Incorrect email or password.",
    )
  return { id: user.id, name: user.name, email: user.email }
}

export function sessionCookie(request: NextRequest, userId: string) {
  return `${SESSION_COOKIE}=${createSessionToken(userId)}; ${cookieAttributes(request, SESSION_MAX_AGE)}`
}

export function clearSessionCookie(request: NextRequest) {
  return `${SESSION_COOKIE}=; ${cookieAttributes(request, 0)}`
}
