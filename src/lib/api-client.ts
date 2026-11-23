import { SUPPORTED_IMAGE_FORMATS } from "@/config/upload"
import { extractMetadata } from "@/lib/extract-metadata"
import { SIGNATURE_BYTES } from "@/lib/image-signature"
import {
  createCanvasPreview,
  getLocalAnalysis,
  removeLocalAnalysis,
  saveLocalAnalysis,
} from "@/lib/preview-store"
import type {
  HistoryItem,
  ImageAnalysis,
  Place,
  SessionState,
  VisionResult,
} from "@/types/analysis"

export class ClientApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message)
  }
}

const GENERIC_ERROR = "Something went wrong. Please try again."
const TOO_LARGE_ERROR = "This image has too much metadata to process."

function toError(status: number, body: unknown) {
  const error = (body as { error?: { code?: string; message?: string } } | null)
    ?.error
  return new ClientApiError(
    status,
    error?.code ?? "unknown",
    error?.message ?? (status === 413 ? TOO_LARGE_ERROR : GENERIC_ERROR),
  )
}

async function send(url: string, init?: RequestInit) {
  try {
    return await fetch(url, init)
  } catch (reason) {
    if (reason instanceof DOMException && reason.name === "AbortError") {
      throw new ClientApiError(0, "aborted", "Upload canceled.")
    }
    throw new ClientApiError(0, "network", "Could not reach the server.")
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await send(url, init)
  if (response.status === 204) return undefined as T
  const body: unknown = await response.json().catch(() => null)
  if (!response.ok) throw toError(response.status, body)
  return body as T
}

const jsonPost = (body: unknown, signal?: AbortSignal): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
  signal,
})

export type UploadResult = { analysis: ImageAnalysis; preview: string | null }

function toBase64(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes))
}

/** Extracts metadata locally and sends only that metadata for analysis. */
export async function uploadImage(
  file: File,
  options: {
    saveToHistory: boolean
    onProgress: (percent: number) => void
    signal: AbortSignal
  },
): Promise<UploadResult> {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? ""
  const known = SUPPORTED_IMAGE_FORMATS.some((format) =>
    (format.extensions as readonly string[]).includes(extension),
  )
  if (!known)
    throw new ClientApiError(
      415,
      "unsupported_format",
      "This file type is not supported.",
    )

  options.onProgress(10)
  let extracted
  try {
    extracted = await extractMetadata(file, extension)
  } catch {
    throw new ClientApiError(
      422,
      "extraction_failed",
      "Metadata could not be extracted from this image.",
    )
  }
  if (options.signal.aborted) {
    throw new ClientApiError(0, "aborted", "Upload canceled.")
  }
  options.onProgress(70)

  const url = URL.createObjectURL(file)
  const preview = await createCanvasPreview(url).finally(() =>
    URL.revokeObjectURL(url),
  )
  const header = new Uint8Array(
    await file.slice(0, SIGNATURE_BYTES).arrayBuffer(),
  )
  options.onProgress(100)

  const { analysis } = await request<{ analysis: ImageAnalysis }>(
    "/api/images/analyze",
    jsonPost(
      {
        record: extracted.record,
        tempName: extracted.tempName,
        filename: file.name,
        mimeType: file.type,
        size: file.size,
        header: toBase64(header),
        lastModified: file.lastModified,
        decoded: preview !== null,
        saveToHistory: options.saveToHistory,
      },
      options.signal,
    ),
  )
  if (!analysis.savedToHistory) saveLocalAnalysis(analysis)
  return { analysis, preview }
}

function saveFile(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = name
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

function downloadName(response: Response, fallback: string) {
  const header = response.headers.get("Content-Disposition") ?? ""
  return /filename="([^"]+)"/.exec(header)?.[1] ?? fallback
}

export const api = {
  analysis: async (id: string) => {
    const local = getLocalAnalysis(id)
    if (local) return local
    const data = await request<{ analysis: ImageAnalysis }>(`/api/images/${id}`)
    return data.analysis
  },
  remove: async (id: string) => {
    if (getLocalAnalysis(id)) {
      removeLocalAnalysis(id)
      return
    }
    await request<void>(`/api/images/${id}`, { method: "DELETE" })
  },
  geocode: async (id: string) => {
    const local = getLocalAnalysis(id)
    if (!local) {
      const data = await request<{ place: Place }>(
        `/api/images/${id}/geocode`,
        { method: "POST" },
      )
      return data.place
    }
    const { latitude, longitude } = local.location
    const { place } = await request<{ place: Place }>(
      "/api/images/geocode",
      jsonPost({ latitude, longitude }),
    )
    saveLocalAnalysis({ ...local, location: { ...local.location, place } })
    return place
  },
  vision: async (id: string, previewDataUrl: string) => {
    const blob = await (await fetch(previewDataUrl)).blob()
    const form = new FormData()
    form.append(
      "preview",
      new File([blob], "preview.webp", { type: blob.type }),
    )
    const local = getLocalAnalysis(id)
    const data = await request<{ vision: VisionResult }>(
      local ? "/api/images/vision" : `/api/images/${id}/vision`,
      { method: "POST", body: form },
    )
    if (local) saveLocalAnalysis({ ...local, vision: data.vision })
    return data.vision
  },
  downloadReport: async (analysis: ImageAnalysis, format: string) => {
    const local = getLocalAnalysis(analysis.id)
    const response = local
      ? await send(
          `/api/images/report?format=${format}`,
          jsonPost({ analysis: local }),
        )
      : await send(`/api/images/${analysis.id}/report?format=${format}`)
    if (!response.ok) {
      throw toError(response.status, await response.json().catch(() => null))
    }
    saveFile(await response.blob(), downloadName(response, `report.${format}`))
  },
  downloadMetadata: (analysis: ImageAnalysis) => {
    const body = {
      id: analysis.id,
      fieldCount: analysis.fields.length,
      fields: analysis.fields,
      raw: analysis.raw,
    }
    saveFile(
      new Blob([JSON.stringify(body, null, 2)], { type: "application/json" }),
      `${analysis.file.originalFilename}-metadata.json`,
    )
  },
  session: () => request<SessionState>("/api/auth/me"),
  login: (body: { email: string; password: string }) =>
    request("/api/auth/login", jsonPost(body)),
  register: (body: { name: string; email: string; password: string }) =>
    request("/api/auth/register", jsonPost(body)),
  logout: () => request<void>("/api/auth/logout", { method: "POST" }),
  history: (query: string) =>
    request<{ items: HistoryItem[] }>(
      `/api/history?q=${encodeURIComponent(query)}`,
    ).then((data) => data.items),
}
