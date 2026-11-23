export const NOT_AVAILABLE = "Information not available in the uploaded image."

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function greatestCommonDivisor(a: number, b: number): number {
  return b === 0 ? a : greatestCommonDivisor(b, a % b)
}

export function aspectRatio(width: number, height: number) {
  if (width <= 0 || height <= 0) return null
  const divisor = greatestCommonDivisor(width, height)
  const w = width / divisor
  const h = height / divisor
  return w <= 32 && h <= 32 ? `${w}:${h}` : `${(width / height).toFixed(2)}:1`
}

export function safeDownloadName(filename: string, suffix: string) {
  const stem = filename
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
  return `${stem || "image"}-${suffix}`
}
