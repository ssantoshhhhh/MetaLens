import { randomUUID } from "node:crypto"
import type { ImageAnalysis } from "@/types/analysis"
import { ApiError } from "@/server/errors"
import { analyzeMetadata } from "@/server/services/analysis"
import { buildImageProperties } from "@/server/services/image"
import { extractLocation } from "@/server/services/location"
import {
  extractCamera,
  extractDateTime,
  extractDevice,
} from "@/server/services/metadata/extract"
import {
  MetadataIndex,
  normalizeMetadata,
} from "@/server/services/metadata/normalize"
import { validateUpload } from "@/server/services/upload"

export type PipelineInput = {
  /** ExifTool JSON produced in the user's browser. Treated as untrusted data. */
  record: Record<string, unknown>
  tempName: string
  /** The file's leading bytes, used for signature validation. */
  header: Uint8Array
  size: number
  filename: string
  declaredMime: string
  clientLastModified: number | null
  decoded: boolean
}

export function runAnalysis(input: PipelineInput): ImageAnalysis {
  const upload = validateUpload({
    filename: input.filename,
    declaredMime: input.declaredMime,
    bytes: input.header,
    size: input.size,
  })
  const lastModified =
    input.clientLastModified !== null &&
    Number.isFinite(input.clientLastModified) &&
    input.clientLastModified > 0 &&
    input.clientLastModified <= 8.64e15
      ? new Date(input.clientLastModified).toISOString()
      : null

  const { fields, raw } = normalizeMetadata(input.record, {
    tempPath: input.tempName,
    originalFilename: upload.filename,
    clientLastModified: lastModified,
  })
  const index = new MetadataIndex(fields)
  const image = buildImageProperties(index, null)
  if (!image.width && (input.record["ExifTool:Error"] || !input.decoded)) {
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
  // Browsers cannot all decode HEIC, TIFF, or BMP, so a failed preview is not damage.
  if (!input.decoded && !["heic", "bmp", "tiff"].includes(upload.format.id)) {
    analysis.observations.push({
      code: "decode_failed",
      severity: "warning",
      title: "Image data could not be fully decoded",
      detail:
        "The file may be damaged or too large to decode. Its metadata was still read.",
    })
  }

  return {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    expiresAt: null,
    savedToHistory: false,
    file: {
      originalFilename: upload.filename,
      extension: upload.extension,
      mimeType: upload.mimeType,
      format: upload.format.label,
      size: input.size,
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
}
