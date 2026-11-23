import type { ImageFormatId } from "@/config/upload"

/** Bytes needed by detectImageFormat. */
export const SIGNATURE_BYTES = 64

const HEIC_BRANDS = new Set([
  "heic",
  "heix",
  "hevc",
  "hevx",
  "heim",
  "heis",
  "hevm",
  "hevs",
])
const AVIF_BRANDS = new Set(["avif", "avis"])
const GENERIC_HEIF_BRANDS = new Set(["mif1", "msf1"])

function ascii(bytes: Uint8Array, start: number, end: number) {
  return String.fromCharCode(...bytes.subarray(start, end))
}

function startsWith(bytes: Uint8Array, signature: number[]) {
  return signature.every((value, index) => bytes[index] === value)
}

function detectIsoMedia(bytes: Uint8Array): ImageFormatId | null {
  if (bytes.length < 12 || ascii(bytes, 4, 8) !== "ftyp") return null
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const boxSize = Math.min(view.getUint32(0), bytes.length)
  const brands = [ascii(bytes, 8, 12)]
  for (let offset = 16; offset + 4 <= boxSize; offset += 4) {
    brands.push(ascii(bytes, offset, offset + 4))
  }
  if (brands.some((brand) => AVIF_BRANDS.has(brand))) return "avif"
  if (brands.some((brand) => HEIC_BRANDS.has(brand))) return "heic"
  if (brands.some((brand) => GENERIC_HEIF_BRANDS.has(brand))) return "heic"
  return null
}

/** Identifies an image by its leading bytes, ignoring its name and MIME type. */
export function detectImageFormat(bytes: Uint8Array): ImageFormatId | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "jpeg"
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return "png"
  }
  if (
    startsWith(bytes, [0x49, 0x49, 0x2a, 0x00]) ||
    startsWith(bytes, [0x4d, 0x4d, 0x00, 0x2a])
  ) {
    return "tiff"
  }
  if (
    bytes.length >= 12 &&
    ascii(bytes, 0, 4) === "RIFF" &&
    ascii(bytes, 8, 12) === "WEBP"
  ) {
    return "webp"
  }
  if (bytes.length >= 6) {
    const header = ascii(bytes, 0, 6)
    if (header === "GIF87a" || header === "GIF89a") return "gif"
  }
  if (startsWith(bytes, [0x42, 0x4d]) && bytes.length >= 26) return "bmp"
  return detectIsoMedia(bytes)
}
