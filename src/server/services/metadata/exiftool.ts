import { execFile } from "node:child_process"
import { access, constants } from "node:fs/promises"
import path from "node:path"
import { promisify } from "node:util"
import { ApiError } from "@/server/errors"

const run = promisify(execFile)
const TIMEOUT_MS = 20_000
const MAX_OUTPUT_BYTES = 64 * 1024 * 1024

let resolved: string | null = null

async function exiftoolPath() {
  if (resolved) return resolved
  const vendored = path.join(
    process.cwd(),
    "node_modules/exiftool-vendored.pl/bin/exiftool",
  )
  const configured = process.env.EXIFTOOL_PATH
  if (configured) return (resolved = configured)
  try {
    await access(vendored, constants.X_OK)
    return (resolved = vendored)
  } catch {
    return (resolved = "exiftool")
  }
}

export async function exiftoolVersion() {
  const { stdout } = await run(await exiftoolPath(), ["-ver"], {
    timeout: 5_000,
  })
  return stdout.trim()
}

/**
 * Reads all groups, including duplicates (-a) and unknown tags (-u).
 * Arguments are passed without a shell, and metadata is only ever parsed as JSON.
 */
export async function readAllMetadata(filePath: string) {
  const args = [
    "-json",
    "-long",
    "-a",
    "-u",
    "-G0:1:4",
    "-charset",
    "filename=UTF8",
    filePath,
  ]
  let stdout: string
  try {
    const result = await run(await exiftoolPath(), args, {
      timeout: TIMEOUT_MS,
      maxBuffer: MAX_OUTPUT_BYTES,
    })
    stdout = result.stdout
  } catch (error) {
    // ExifTool exits non-zero for some damaged files but can still emit JSON.
    const partial = (error as { stdout?: string }).stdout
    if (!partial) {
      throw new ApiError(
        502,
        "extraction_failed",
        "Metadata could not be extracted.",
      )
    }
    stdout = partial
  }
  try {
    const [record] = JSON.parse(stdout) as [Record<string, unknown>]
    return record
  } catch {
    throw new ApiError(
      502,
      "extraction_failed",
      "Metadata could not be extracted.",
    )
  }
}

/** Extracts the largest embedded preview, if any. Used only for transient display. */
export async function readEmbeddedPreview(filePath: string) {
  const bin = await exiftoolPath()
  for (const tag of ["-PreviewImage", "-JpgFromRaw", "-ThumbnailImage"]) {
    try {
      const { stdout } = await run(bin, ["-b", tag, filePath], {
        encoding: "buffer",
        timeout: TIMEOUT_MS,
        maxBuffer: MAX_OUTPUT_BYTES,
      })
      if (stdout.length > 0) return stdout
    } catch {
      // Try the next embedded image.
    }
  }
  return null
}
