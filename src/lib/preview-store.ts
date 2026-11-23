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
  try {
    for (const name of Object.keys(sessionStorage)) {
      if (name.startsWith("metalens-preview:")) sessionStorage.removeItem(name)
    }
  } catch {
    // Nothing to clean up.
  }
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
