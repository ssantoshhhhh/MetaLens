import { randomUUID } from "node:crypto"
import type { ImageAnalysis } from "@/types/analysis"
import { ApiError } from "@/server/errors"
import { analyzeMetadata } from "@/server/services/analysis"
import {
  buildImageProperties,
  createPreview,
  readImageInfo,
} from "@/server/services/image"
import { extractLocation } from "@/server/services/location"
import { readAllMetadata } from "@/server/services/metadata/exiftool"
import {
  extractCamera,
  extractDateTime,
  extractDevice,
} from "@/server/services/metadata/extract"
import {
  MetadataIndex,
  normalizeMetadata,
} from "@/server/services/metadata/normalize"
import { validateUpload, withTempFile } from "@/server/services/upload"

const PIPELINE_TIMEOUT_MS = 45_000
const MAX_CONCURRENT = 8

const limiter = globalThis as typeof globalThis & { __mlActive?: number }

function withTimeout<T>(work: Promise<T>) {
  let timer: NodeJS.Timeout
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () =>
        reject(
          new ApiError(504, "analysis_timeout", "Image analysis timed out."),
        ),
      PIPELINE_TIMEOUT_MS,
    )
  })
  return Promise.race([work, timeout]).finally(() => clearTimeout(timer))
}

export type PipelineInput = {
  bytes: Uint8Array
  filename: string
  declaredMime: string
  clientLastModified: number | null
}

export async function runAnalysis(input: PipelineInput) {
  const upload = validateUpload(input)
  const active = limiter.__mlActive ?? 0
  if (active >= MAX_CONCURRENT) {
    throw new ApiError(
      503,
      "server_busy",
      "The server is busy. Try again shortly.",
      {
        "Retry-After": "5",
      },
    )
  }
  limiter.__mlActive = active + 1

  const lastModified =
    input.clientLastModified !== null &&
    Number.isFinite(input.clientLastModified) &&
    input.clientLastModified > 0
      ? new Date(input.clientLastModified).toISOString()
      : null

  try {
    return await withTimeout(
      withTempFile(input.bytes, upload.extension, async (filePath) => {
        const [record, info, rendered] = await Promise.all([
          readAllMetadata(filePath),
          readImageInfo(filePath),
          createPreview(filePath),
        ])
        const parserError = record["ExifTool:Error"]
        if (parserError && !info) {
          throw new ApiError(
            422,
            "corrupted_image",
            "This image appears to be corrupted.",
          )
        }

        const { fields, raw } = normalizeMetadata(record, {
          tempPath: filePath,
          originalFilename: upload.filename,
          clientLastModified: lastModified,
        })
        const index = new MetadataIndex(fields)
        const image = buildImageProperties(index, info)
        if (!image.width && !rendered.decoded) {
          throw new ApiError(
            422,
            "corrupted_image",
            "This image appears to be corrupted.",
          )
        }
        const device = extractDevice(index)
        const dateTime = extractDateTime(index, lastModified)
        const location = extractLocation(index)
        const camera = extractCamera(index)
        const analysis = analyzeMetadata(index, {
          device,
          dateTime,
          location,
          camera,
          image,
        })
        if (!rendered.decoded && !["heic", "bmp"].includes(upload.format.id)) {
          analysis.observations.push({
            code: "decode_failed",
            severity: "warning",
            title: "Image data could not be fully decoded",
            detail:
              "The file may be damaged or too large to decode. Its metadata was still read.",
          })
        }

        const result: ImageAnalysis = {
          id: randomUUID(),
          createdAt: new Date().toISOString(),
          expiresAt: null,
          savedToHistory: false,
          file: {
            originalFilename: upload.filename,
            extension: upload.extension,
            mimeType: upload.mimeType,
            format: upload.format.label,
            size: input.bytes.byteLength,
            clientLastModified: lastModified,
          },
          device,
          dateTime,
          location,
          camera,
          image,
          fields,
          raw,
          analysis,
          vision: null,
        }
        return { analysis: result, preview: rendered.preview }
      }),
    )
  } finally {
    limiter.__mlActive = Math.max((limiter.__mlActive ?? 1) - 1, 0)
  }
}
