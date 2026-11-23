import sharp from "sharp"
import { aspectRatio } from "@/lib/format"
import type { ImageProperties } from "@/types/analysis"
import type { MetadataIndex } from "@/server/services/metadata/normalize"

const PREVIEW_SIZE = 1024
sharp.cache(false)

export type SharpInfo = {
  width: number | null
  height: number | null
  space: string | null
  depth: string | null
  hasAlpha: boolean | null
  iccDescription: string | null
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
        "RIFF:ImageWidth",
        "GIF:ImageWidth",
        "EXIF:ExifImageWidth",
        "EXIF:ImageWidth",
        "QuickTime:ImageWidth",
      )?.rawValue,
    )
  const height =
    info?.height ??
    positiveNumber(
      index.field(
        "File:ImageHeight",
        "PNG:ImageHeight",
        "RIFF:ImageHeight",
        "GIF:ImageHeight",
        "EXIF:ExifImageHeight",
        "EXIF:ImageHeight",
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
    hasAlpha:
      info?.hasAlpha ??
      (index.text("PNG:ColorType")
        ? /alpha/i.test(index.text("PNG:ColorType") ?? "")
        : null),
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
