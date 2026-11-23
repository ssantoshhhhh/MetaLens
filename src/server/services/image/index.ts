import sharp from "sharp"
import { aspectRatio } from "@/lib/format"
import type { ImageProperties } from "@/types/analysis"
import { readEmbeddedPreview } from "@/server/services/metadata/exiftool"
import type { MetadataIndex } from "@/server/services/metadata/normalize"

/** Protects the decoder from decompression bombs. */
const MAX_INPUT_PIXELS = 200_000_000
const PREVIEW_SIZE = 1024
sharp.cache(false)

const options = { limitInputPixels: MAX_INPUT_PIXELS, failOn: "error" } as const

export type SharpInfo = {
  width: number | null
  height: number | null
  space: string | null
  depth: string | null
  hasAlpha: boolean | null
  iccDescription: string | null
}

export async function readImageInfo(
  filePath: string,
): Promise<SharpInfo | null> {
  try {
    const info = await sharp(filePath, options).metadata()
    return {
      width: info.width ?? null,
      height: info.height ?? null,
      space: info.space ?? null,
      depth: info.depth ?? null,
      hasAlpha: info.hasAlpha ?? null,
      iccDescription: null,
    }
  } catch {
    // HEIC and some other files need ExifTool's values instead.
    return null
  }
}

function positiveNumber(value: unknown) {
  const number = typeof value === "number" ? value : Number(value)
  return Number.isFinite(number) && number > 0 ? number : null
}

export function buildImageProperties(
  index: MetadataIndex,
  info: SharpInfo | null,
): ImageProperties {
  const width =
    info?.width ??
    positiveNumber(
      index.field(
        "File:ImageWidth",
        "PNG:ImageWidth",
        "EXIF:ExifImageWidth",
        "QuickTime:ImageWidth",
      )?.rawValue,
    )
  const height =
    info?.height ??
    positiveNumber(
      index.field(
        "File:ImageHeight",
        "PNG:ImageHeight",
        "EXIF:ExifImageHeight",
        "QuickTime:ImageHeight",
      )?.rawValue,
    )
  const totalPixels = width && height ? width * height : null

  const xResolution = index.text(
    "EXIF:XResolution",
    "JFIF:XResolution",
    "PNG:PixelsPerUnitX",
  )
  const yResolution = index.text(
    "EXIF:YResolution",
    "JFIF:YResolution",
    "PNG:PixelsPerUnitY",
  )
  const unit = index.text(
    "EXIF:ResolutionUnit",
    "JFIF:ResolutionUnit",
    "PNG:PixelUnits",
  )
  const bits = index.text(
    "File:BitsPerSample",
    "PNG:BitDepth",
    "EXIF:BitsPerSample",
  )

  return {
    width,
    height,
    aspectRatio: width && height ? aspectRatio(width, height) : null,
    megapixels: totalPixels
      ? Number((totalPixels / 1_000_000).toFixed(2))
      : null,
    totalPixels,
    resolution: xResolution
      ? `${xResolution} × ${yResolution ?? xResolution}${unit ? ` (${unit})` : ""}`
      : null,
    colorSpace:
      index.text(
        "EXIF:ColorSpace",
        "ICC_Profile:ColorSpaceData",
        "PNG:ColorType",
      ) ??
      info?.space ??
      null,
    bitDepth: bits ? `${bits}-bit` : (info?.depth ?? null),
    compression: index.text(
      "EXIF:Compression",
      "File:EncodingProcess",
      "PNG:Compression",
      "RIFF:VP8Version",
    ),
    orientation: index.text("EXIF:Orientation", "XMP:Orientation"),
    iccProfile: index.text("ICC_Profile:ProfileDescription"),
    hasAlpha: info?.hasAlpha ?? null,
    hasEmbeddedThumbnail:
      Boolean(
        index.field(
          "EXIF:ThumbnailImage",
          "EXIF:PreviewImage",
          "MakerNotes:PreviewImage",
          "Composite:PreviewImage",
        ),
      ) ||
      index.fields.some(
        (field) =>
          /(Thumbnail|Preview)Image$/.test(field.name) &&
          field.status === "binary",
      ),
  }
}

async function encodePreview(input: string | Buffer) {
  const buffer = await sharp(input, options)
    .rotate()
    .resize(PREVIEW_SIZE, PREVIEW_SIZE, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 72 })
    .toBuffer()
  return `data:image/webp;base64,${buffer.toString("base64")}`
}

/** Creates a metadata-free preview that is returned once and never stored on the server. */
export async function createPreview(filePath: string) {
  try {
    return { preview: await encodePreview(filePath), decoded: true }
  } catch {
    const embedded = await readEmbeddedPreview(filePath)
    if (embedded) {
      try {
        return { preview: await encodePreview(embedded), decoded: false }
      } catch {
        // Fall through to no preview.
      }
    }
    return { preview: null, decoded: false }
  }
}

/** Re-encodes a client-supplied preview so only clean pixels leave the server. */
export async function sanitizeForVision(bytes: Uint8Array) {
  return sharp(bytes, { limitInputPixels: 8_000_000, failOn: "error" })
    .rotate()
    .resize(PREVIEW_SIZE, PREVIEW_SIZE, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: 82 })
    .toBuffer()
}
