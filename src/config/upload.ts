/** Shared upload rules used by both the client and server validators. */
export const MAX_UPLOAD_SIZE_MB = 25
export const MAX_UPLOAD_SIZE_BYTES = MAX_UPLOAD_SIZE_MB * 1024 * 1024

export const SUPPORTED_IMAGE_FORMATS = [
  {
    id: "jpeg",
    label: "JPG",
    extensions: ["jpg", "jpeg"],
    mimeTypes: ["image/jpeg"],
  },
  { id: "png", label: "PNG", extensions: ["png"], mimeTypes: ["image/png"] },
  {
    id: "tiff",
    label: "TIFF",
    extensions: ["tif", "tiff"],
    mimeTypes: ["image/tiff"],
  },
  {
    id: "webp",
    label: "WebP",
    extensions: ["webp"],
    mimeTypes: ["image/webp"],
  },
  {
    id: "heic",
    label: "HEIC",
    extensions: ["heic", "heif"],
    mimeTypes: ["image/heic", "image/heif"],
  },
  {
    id: "avif",
    label: "AVIF",
    extensions: ["avif"],
    mimeTypes: ["image/avif"],
  },
  { id: "gif", label: "GIF", extensions: ["gif"], mimeTypes: ["image/gif"] },
  {
    id: "bmp",
    label: "BMP",
    extensions: ["bmp"],
    mimeTypes: ["image/bmp", "image/x-ms-bmp"],
  },
] as const

export type ImageFormatId = (typeof SUPPORTED_IMAGE_FORMATS)[number]["id"]

export const UPLOAD_ACCEPT = SUPPORTED_IMAGE_FORMATS.flatMap((format) =>
  format.extensions.map((extension) => `.${extension}`),
).join(",")

export const METADATA_STANDARDS = [
  { name: "EXIF", detail: "Device, capture time, exposure" },
  { name: "GPS", detail: "Coordinates, altitude, direction" },
  { name: "IPTC", detail: "Captions, credits, keywords" },
  { name: "XMP", detail: "Editing history and ratings" },
  { name: "ICC", detail: "Embedded color profiles" },
  { name: "MakerNotes", detail: "Manufacturer-specific fields" },
] as const
