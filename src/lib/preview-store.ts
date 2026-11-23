import type { ImageAnalysis } from "@/types/analysis"

/** Keeps the transient preview in this browser tab only. It is never stored on the server. */
const memory = new Map<string, string>()
const key = (id: string) => `metalens-preview:${id}`

export function savePreview(id: string, preview: string | null) {
  if (!preview) return
  memory.set(id, preview)
  try {
    sessionStorage.setItem(key(id), preview)
  } catch {
    // Storage may be full or blocked. The in-memory copy still works.
  }
}

export function getPreview(id: string) {
  const cached = memory.get(id)
  if (cached) return cached
  try {
    return sessionStorage.getItem(key(id))
  } catch {
    return null
  }
}

export function removePreview(id: string) {
  memory.delete(id)
  try {
    sessionStorage.removeItem(key(id))
  } catch {
    // Nothing to clean up.
  }
}

export function clearPreviews() {
  memory.clear()
  analyses.clear()
  try {
    for (const name of Object.keys(sessionStorage)) {
      if (
        name.startsWith("metalens-preview:") ||
        name.startsWith("metalens-analysis:")
      ) {
        sessionStorage.removeItem(name)
      }
    }
  } catch {
    // Nothing to clean up.
  }
}

/** Temporary analyses live only in this browser tab and expire on their own. */
const analyses = new Map<string, ImageAnalysis>()
const analysisKey = (id: string) => `metalens-analysis:${id}`

export function saveLocalAnalysis(analysis: ImageAnalysis) {
  analyses.set(analysis.id, analysis)
  try {
    sessionStorage.setItem(analysisKey(analysis.id), JSON.stringify(analysis))
  } catch {
    // Storage may be full or blocked. The in-memory copy still works.
  }
}

export function removeLocalAnalysis(id: string) {
  analyses.delete(id)
  try {
    sessionStorage.removeItem(analysisKey(id))
  } catch {
    // Nothing to clean up.
  }
}

export function getLocalAnalysis(id: string) {
  let analysis = analyses.get(id) ?? null
  if (!analysis) {
    try {
      const stored = sessionStorage.getItem(analysisKey(id))
      analysis = stored ? (JSON.parse(stored) as ImageAnalysis) : null
    } catch {
      return null
    }
  }
  if (analysis?.expiresAt && Date.parse(analysis.expiresAt) <= Date.now()) {
    removeLocalAnalysis(id)
    removePreview(id)
    return null
  }
  return analysis
}

/** Builds a local preview for formats the browser can show but the server cannot decode. */
export async function createCanvasPreview(url: string, maxSize = 1024) {
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    const scale = Math.min(
      1,
      maxSize / Math.max(image.naturalWidth, image.naturalHeight),
    )
    const canvas = document.createElement("canvas")
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
    canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL("image/webp", 0.72)
  } catch {
    return null
  }
}
