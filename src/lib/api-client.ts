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

function toError(status: number, body: unknown) {
  const error = (body as { error?: { code?: string; message?: string } } | null)
    ?.error
  return new ClientApiError(
    status,
    error?.code ?? "unknown",
    error?.message ?? GENERIC_ERROR,
  )
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(url, init)
  } catch {
    throw new ClientApiError(0, "network", "Could not reach the server.")
  }
  if (response.status === 204) return undefined as T
  const body: unknown = await response.json().catch(() => null)
  if (!response.ok) throw toError(response.status, body)
  return body as T
}

const jsonPost = (body: unknown): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
})

export type UploadResult = { analysis: ImageAnalysis; preview: string | null }

export function uploadImage(
  file: File,
  options: {
    saveToHistory: boolean
    onProgress: (percent: number) => void
    signal: AbortSignal
  },
) {
  return new Promise<UploadResult>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    const form = new FormData()
    form.append("file", file)
    form.append("lastModified", String(file.lastModified))
    form.append("saveToHistory", String(options.saveToHistory))
    xhr.open("POST", "/api/images/analyze")
    xhr.responseType = "json"
    xhr.timeout = 90_000
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable)
        options.onProgress(Math.round((event.loaded / event.total) * 100))
    }
    xhr.onload = () => {
      if (xhr.status === 201) resolve(xhr.response as UploadResult)
      else reject(toError(xhr.status, xhr.response))
    }
    xhr.onerror = () =>
      reject(new ClientApiError(0, "network", "Could not reach the server."))
    xhr.ontimeout = () =>
      reject(new ClientApiError(504, "timeout", "The analysis timed out."))
    xhr.onabort = () =>
      reject(new ClientApiError(0, "aborted", "Upload canceled."))
    options.signal.addEventListener("abort", () => xhr.abort(), { once: true })
    xhr.send(form)
  })
}

export const api = {
  analysis: (id: string) =>
    request<{ analysis: ImageAnalysis }>(`/api/images/${id}`).then(
      (data) => data.analysis,
    ),
  remove: (id: string) =>
    request<void>(`/api/images/${id}`, { method: "DELETE" }),
  geocode: (id: string) =>
    request<{ place: Place }>(`/api/images/${id}/geocode`, {
      method: "POST",
    }).then((data) => data.place),
  vision: async (id: string, previewDataUrl: string) => {
    const blob = await (await fetch(previewDataUrl)).blob()
    const form = new FormData()
    form.append(
      "preview",
      new File([blob], "preview.webp", { type: blob.type }),
    )
    const data = await request<{ vision: VisionResult }>(
      `/api/images/${id}/vision`,
      {
        method: "POST",
        body: form,
      },
    )
    return data.vision
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
