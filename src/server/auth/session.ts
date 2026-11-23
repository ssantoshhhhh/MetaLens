import {
  createHmac,
  randomBytes,
  randomUUID,
  scrypt,
  timingSafeEqual,
} from "node:crypto"
import { promisify } from "node:util"

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  length: number,
) => Promise<Buffer>

export const SESSION_COOKIE = "ml_session"
export const OWNER_COOKIE = "ml_owner"
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export const isUuid = (value: string) => UUID.test(value)
export const newOwnerKey = () => randomUUID()

export function authSecret() {
  const secret = process.env.AUTH_SECRET
  return secret && secret.length >= 32 ? secret : null
}

export function isAuthEnabled() {
  return Boolean(process.env.DATABASE_URL && authSecret())
}

function sign(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url")
}

export function createSessionToken(userId: string, now = Date.now()) {
  const secret = authSecret()
  if (!secret) throw new Error("AUTH_SECRET is not configured")
  const payload = Buffer.from(
    JSON.stringify({ sub: userId, exp: now + SESSION_MAX_AGE * 1000 }),
  ).toString("base64url")
  return `${payload}.${sign(payload, secret)}`
}

export function verifySessionToken(
  token: string | undefined,
  now = Date.now(),
) {
  const secret = authSecret()
  if (!token || !secret) return null
  const [payload, signature] = token.split(".")
  if (!payload || !signature) return null
  const expected = Buffer.from(sign(payload, secret))
  const actual = Buffer.from(signature)
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return null
  }
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString()) as {
      sub?: unknown
      exp?: unknown
    }
    if (typeof data.sub !== "string" || typeof data.exp !== "number")
      return null
    return data.exp > now ? data.sub : null
  } catch {
    return null
  }
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16)
  const derived = await scryptAsync(password, salt, 64)
  return `scrypt$${salt.toString("base64")}$${derived.toString("base64")}`
}

export async function verifyPassword(password: string, stored: string) {
  const [scheme, salt, hash] = stored.split("$")
  if (scheme !== "scrypt" || !salt || !hash) return false
  const expected = Buffer.from(hash, "base64")
  const derived = await scryptAsync(
    password,
    Buffer.from(salt, "base64"),
    expected.length,
  )
  return timingSafeEqual(derived, expected)
}
