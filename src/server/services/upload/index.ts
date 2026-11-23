import path from "node:path"
import {
  MAX_UPLOAD_SIZE_BYTES,
  MAX_UPLOAD_SIZE_MB,
  SUPPORTED_IMAGE_FORMATS,
} from "@/config/upload"
import { detectImageFormat } from "@/lib/image-signature"
import { ApiError } from "@/server/errors"

const MULTIPART_OVERHEAD = 1024 * 1024
const GENERIC_MIME_TYPES = new Set(["", "application/octet-stream"])

const tooLarge = () =>
  new ApiError(
    413,
    "file_too_large",
    `Images must be ${MAX_UPLOAD_SIZE_MB} MB or smaller.`,
  )

/** Reads a multipart body while enforcing the size limit as bytes arrive. */
export async function readLimitedFormData(request: Request, maxBytes?: number) {
  const limit = (maxBytes ?? MAX_UPLOAD_SIZE_BYTES) + MULTIPART_OVERHEAD
  const contentType = request.headers.get("content-type") ?? ""
  if (!contentType.toLowerCase().startsWith("multipart/form-data")) {
    throw new ApiError(
      400,
      "invalid_request",
      "Expected a multipart form upload.",
    )
  }
  const declared = Number(request.headers.get("content-length") ?? 0)
  if (declared > limit) throw tooLarge()
  if (!request.body)
    throw new ApiError(400, "invalid_request", "Missing request body.")

  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let received = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    received += value.byteLength
    if (received > limit) {
      await reader.cancel()
      throw tooLarge()
    }
    chunks.push(value)
  }
  try {
    return await new Response(Buffer.concat(chunks), {
      headers: { "content-type": contentType },
    }).formData()
  } catch {
    throw new ApiError(400, "invalid_request", "The upload could not be read.")
  }
}

export function sanitizeFilename(filename: string) {
  const base = filename.split(/[\\/]/).at(-1) ?? ""
  const clean = base
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(-255)
  return clean || "image"
}

export type ValidatedUpload = {
  filename: string
  extension: string
  mimeType: string
  format: (typeof SUPPORTED_IMAGE_FORMATS)[number]
}

export function validateUpload(input: {
  filename: string
  declaredMime: string
  bytes: Uint8Array
  /** Full file size when `bytes` holds only the file's leading signature. */
  size?: number
}): ValidatedUpload {
  const size = input.size ?? input.bytes.byteLength
  if (size === 0 || input.bytes.byteLength === 0) {
    throw new ApiError(400, "empty_file", "The uploaded file is empty.")
  }
  if (size > MAX_UPLOAD_SIZE_BYTES) throw tooLarge()

  const filename = sanitizeFilename(input.filename)
  const extension = path.extname(filename).slice(1).toLowerCase()
  const byExtension = SUPPORTED_IMAGE_FORMATS.find((format) =>
    (format.extensions as readonly string[]).includes(extension),
  )
  if (!byExtension) {
    throw new ApiError(
      415,
      "unsupported_format",
      "This file type is not supported.",
    )
  }

  const detected = detectImageFormat(input.bytes)
  if (!detected) {
    throw new ApiError(
      415,
      "invalid_signature",
      "The file contents do not match a supported image format.",
    )
  }
  if (detected !== byExtension.id) {
    throw new ApiError(
      415,
      "signature_mismatch",
      "The file extension does not match the file contents.",
    )
  }

  const declaredMime =
    input.declaredMime.split(";")[0]?.trim().toLowerCase() ?? ""
  const mimeTypes = byExtension.mimeTypes as readonly string[]
  if (
    !GENERIC_MIME_TYPES.has(declaredMime) &&
    !mimeTypes.includes(declaredMime)
  ) {
    throw new ApiError(
      415,
      "mime_mismatch",
      "The file type does not match the file contents.",
    )
  }

  return {
    filename,
    extension,
    mimeType: mimeTypes[0] ?? "application/octet-stream",
    format: byExtension,
  }
}

/** Reads a JSON body while enforcing a byte limit as data arrives. */
export async function readLimitedJson(request: Request, maxBytes: number) {
  const declared = Number(request.headers.get("content-length") ?? 0)
  const metadataTooLarge = () =>
    new ApiError(
      413,
      "metadata_too_large",
      "This image has too much metadata to process.",
    )
  if (declared > maxBytes) throw metadataTooLarge()
  if (!request.body)
    throw new ApiError(400, "invalid_request", "Missing request body.")
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let received = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    received += value.byteLength
    if (received > maxBytes) {
      await reader.cancel()
      throw metadataTooLarge()
    }
    chunks.push(value)
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown
  } catch {
    throw new ApiError(400, "invalid_request", "The request could not be read.")
  }
}
