import {
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  randomBytes,
} from "node:crypto"
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "@/generated/prisma/client"
import type { HistoryItem, ImageAnalysis } from "@/types/analysis"
import { authSecret } from "@/server/auth/session"
import { ApiError, notFound } from "@/server/errors"
import type { Principal } from "@/server/http"

const TTL_MS = 30 * 60 * 1000

const holder = globalThis as typeof globalThis & {
  __mlPrisma?: PrismaClient
}

export function db() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString)
    throw new ApiError(503, "history_disabled", "History is not configured.")
  return (holder.__mlPrisma ??= new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  }))
}

function encryptionKey() {
  const secret = authSecret()
  if (!secret)
    throw new ApiError(503, "history_disabled", "History is not configured.")
  return Buffer.from(
    hkdfSync("sha256", secret, "metalens", "analysis-payload-v1", 32),
  )
}

export function encryptPayload(analysis: ImageAnalysis) {
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv)
  cipher.setAAD(Buffer.from(analysis.id))
  const data = Buffer.concat([
    cipher.update(JSON.stringify(analysis), "utf8"),
    cipher.final(),
  ])
  return [iv, cipher.getAuthTag(), data]
    .map((part) => part.toString("base64"))
    .join(".")
}

export function decryptPayload(id: string, payload: string): ImageAnalysis {
  const [iv, tag, data] = payload
    .split(".")
    .map((part) => Buffer.from(part, "base64"))
  if (!iv || !tag || !data) throw new Error("Malformed payload")
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv)
  decipher.setAAD(Buffer.from(id))
  decipher.setAuthTag(tag)
  const text = Buffer.concat([
    decipher.update(data),
    decipher.final(),
  ]).toString("utf8")
  return JSON.parse(text) as ImageAnalysis
}

export async function saveAnalysis(
  analysis: ImageAnalysis,
  userId: string | null,
  saveToHistory: boolean,
) {
  if (saveToHistory && userId) {
    const saved = { ...analysis, savedToHistory: true, expiresAt: null }
    await db().imageAnalysis.create({
      data: {
        id: saved.id,
        originalFilename: saved.file.originalFilename,
        mimeType: saved.file.mimeType,
        fileSize: saved.file.size,
        imageWidth: saved.image.width,
        imageHeight: saved.image.height,
        imageFormat: saved.file.format,
        deviceMake: saved.device.make,
        deviceModel: saved.device.model,
        captureDate: saved.dateTime.original?.date ?? null,
        hasGps: saved.location.hasGps,
        encryptedPayload: encryptPayload(saved),
        history: { create: { userId } },
      },
    })
    return saved
  }
  // Temporary analyses are returned to the browser and never kept on the server.
  return {
    ...analysis,
    expiresAt: new Date(Date.now() + TTL_MS).toISOString(),
  }
}

async function findSaved(id: string, userId: string | null) {
  if (!userId || !process.env.DATABASE_URL) return null
  const row = await db().imageAnalysis.findFirst({
    where: { id, history: { is: { userId } } },
    select: { encryptedPayload: true },
  })
  return row ? decryptPayload(id, row.encryptedPayload) : null
}

export async function getAnalysis(id: string, principal: Principal) {
  const saved = await findSaved(id, principal.userId)
  if (!saved) throw notFound()
  return saved
}

export async function updateAnalysis(
  id: string,
  principal: Principal,
  change: (analysis: ImageAnalysis) => ImageAnalysis,
) {
  const updated = change(await getAnalysis(id, principal))
  await db().imageAnalysis.update({
    where: { id },
    data: { encryptedPayload: encryptPayload(updated) },
  })
  return updated
}

export async function deleteAnalysis(id: string, principal: Principal) {
  if (!principal.userId || !process.env.DATABASE_URL) throw notFound()
  const result = await db().imageAnalysis.deleteMany({
    where: { id, history: { is: { userId: principal.userId } } },
  })
  if (result.count === 0) throw notFound()
}

export async function listHistory(
  userId: string,
  query: string,
): Promise<HistoryItem[]> {
  const term = query.trim().slice(0, 100)
  const rows = await db().analysisHistory.findMany({
    where: {
      userId,
      ...(term
        ? {
            imageAnalysis: {
              OR: [
                {
                  originalFilename: {
                    contains: term,
                    mode: "insensitive" as const,
                  },
                },
                {
                  deviceMake: { contains: term, mode: "insensitive" as const },
                },
                {
                  deviceModel: { contains: term, mode: "insensitive" as const },
                },
              ],
            },
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { imageAnalysis: true },
  })
  return rows.map(({ imageAnalysis: item }) => ({
    id: item.id,
    originalFilename: item.originalFilename,
    imageFormat: item.imageFormat,
    fileSize: item.fileSize,
    deviceMake: item.deviceMake,
    deviceModel: item.deviceModel,
    captureDate: item.captureDate,
    hasGps: item.hasGps,
    createdAt: item.createdAt.toISOString(),
  }))
}
