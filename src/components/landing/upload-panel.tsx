"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  AlertCircle,
  FileImage,
  ImageUp,
  Loader2,
  RefreshCw,
  X,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useRef, useState, type DragEvent } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import {
  MAX_UPLOAD_SIZE_BYTES,
  MAX_UPLOAD_SIZE_MB,
  SUPPORTED_IMAGE_FORMATS,
  UPLOAD_ACCEPT,
} from "@/config/upload"
import { api, ClientApiError, uploadImage } from "@/lib/api-client"
import { formatBytes } from "@/lib/format"
import { detectImageFormat, SIGNATURE_BYTES } from "@/lib/image-signature"
import { createCanvasPreview, savePreview } from "@/lib/preview-store"

const corners = [
  "top-3 left-3 border-t-2 border-l-2",
  "top-3 right-3 border-t-2 border-r-2",
  "bottom-3 left-3 border-b-2 border-l-2",
  "right-3 bottom-3 border-r-2 border-b-2",
]

type Selected = { file: File; url: string; format: string; canPreview: boolean }

async function inspectFile(file: File) {
  if (file.size === 0) throw new Error("The selected file is empty.")
  if (file.size > MAX_UPLOAD_SIZE_BYTES) {
    throw new Error(`Images must be ${MAX_UPLOAD_SIZE_MB} MB or smaller.`)
  }
  const extension = file.name.split(".").pop()?.toLowerCase() ?? ""
  const format = SUPPORTED_IMAGE_FORMATS.find((item) =>
    (item.extensions as readonly string[]).includes(extension),
  )
  if (!format) throw new Error("This file type is not supported.")
  const header = new Uint8Array(
    await file.slice(0, SIGNATURE_BYTES).arrayBuffer(),
  )
  const detected = detectImageFormat(header)
  if (!detected)
    throw new Error("The file contents do not match a supported image format.")
  if (detected !== format.id)
    throw new Error("The file extension does not match the file contents.")
  return format
}

export function UploadPanel() {
  const router = useRouter()
  const client = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const urlRef = useRef<string | null>(null)
  const [selected, setSelected] = useState<Selected | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [progress, setProgress] = useState<number | null>(null)
  const [saveToHistory, setSaveToHistory] = useState(false)
  const { data: session } = useQuery({
    queryKey: ["session"],
    queryFn: api.session,
  })
  const busy = progress !== null

  const releaseUrl = useCallback(() => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    urlRef.current = null
  }, [])

  // Next.js can keep this page alive while hidden, so only in-flight work stops here.
  useEffect(() => () => abortRef.current?.abort(), [])

  const choose = async (file: File | undefined) => {
    if (!file || busy) return
    setError(null)
    try {
      const format = await inspectFile(file)
      releaseUrl()
      const url = URL.createObjectURL(file)
      urlRef.current = url
      setSelected({ file, url, format: format.label, canPreview: true })
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "This file could not be read.",
      )
    }
  }

  const clear = () => {
    releaseUrl()
    setSelected(null)
    setError(null)
    if (inputRef.current) inputRef.current.value = ""
  }

  const analyze = async () => {
    if (!selected) return
    setError(null)
    setProgress(0)
    const controller = new AbortController()
    abortRef.current = controller
    try {
      const { analysis, preview } = await uploadImage(selected.file, {
        saveToHistory: saveToHistory && Boolean(session?.user),
        onProgress: setProgress,
        signal: controller.signal,
      })
      savePreview(
        analysis.id,
        preview ??
          (selected.canPreview
            ? await createCanvasPreview(selected.url)
            : null),
      )
      client.setQueryData(["analysis", analysis.id], analysis)
      router.push(`/analysis/${analysis.id}`)
      clear()
      setProgress(null)
      setSaveToHistory(false)
    } catch (reason) {
      if (!(reason instanceof ClientApiError && reason.code === "aborted")) {
        setError(
          reason instanceof Error
            ? reason.message
            : "The image could not be analyzed.",
        )
      }
      setProgress(null)
    }
  }

  const onDrop = (event: DragEvent) => {
    event.preventDefault()
    setDragging(false)
    if (event.dataTransfer.files.length > 1) {
      setError("Upload one image at a time.")
      return
    }
    void choose(event.dataTransfer.files[0])
  }

  return (
    <div
      id="upload"
      onDragOver={(event) => {
        event.preventDefault()
        setDragging(true)
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null))
          setDragging(false)
      }}
      onDrop={onDrop}
      className={`relative mx-auto w-full max-w-3xl rounded-2xl border p-6 shadow-lg shadow-black/5 glass transition-colors sm:p-12 ${dragging ? "border-lens bg-lens-soft" : ""}`}
    >
      {corners.map((corner) => (
        <span
          key={corner}
          aria-hidden
          className={`absolute size-5 rounded-[3px] border-lens ${corner}`}
        />
      ))}
      <input
        ref={inputRef}
        type="file"
        accept={UPLOAD_ACCEPT}
        className="sr-only"
        aria-label="Choose an image"
        tabIndex={-1}
        onChange={(event) => void choose(event.target.files?.[0])}
      />

      {selected ? (
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <div className="flex h-44 w-full shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted sm:size-44">
            {selected.canPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={selected.url}
                alt={`Preview of ${selected.file.name}`}
                className="size-full object-contain"
                onError={() =>
                  setSelected(
                    (current) => current && { ...current, canPreview: false },
                  )
                }
              />
            ) : (
              <div className="flex flex-col items-center gap-2 px-3 text-center text-xs text-muted-foreground">
                <FileImage className="size-7" aria-hidden />
                Preview appears after analysis
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium" title={selected.file.name}>
              {selected.file.name}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {selected.format} · {formatBytes(selected.file.size)}
            </p>
            {session?.user ? (
              <div className="mt-4 flex items-center gap-2">
                <Checkbox
                  id="save-history"
                  checked={saveToHistory}
                  disabled={busy}
                  onCheckedChange={(value) => setSaveToHistory(value === true)}
                />
                <Label htmlFor="save-history" className="font-normal">
                  Save metadata to my history (the image is not stored)
                </Label>
              </div>
            ) : null}
            {busy ? (
              <div className="mt-4" role="status" aria-live="polite">
                <Progress value={progress} aria-label="Analysis progress" />
                <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="size-3 animate-spin" aria-hidden />
                  {progress < 70
                    ? "Reading metadata in your browser…"
                    : "Analyzing metadata…"}
                </p>
              </div>
            ) : (
              <div className="mt-4 flex flex-wrap gap-2">
                <Button onClick={() => void analyze()}>Analyze Image</Button>
                <Button
                  variant="outline"
                  onClick={() => inputRef.current?.click()}
                >
                  <RefreshCw aria-hidden /> Replace
                </Button>
                <Button variant="ghost" onClick={clear}>
                  <X aria-hidden /> Remove
                </Button>
              </div>
            )}
            {busy && progress < 100 ? (
              <Button
                variant="ghost"
                size="sm"
                className="mt-2"
                onClick={() => abortRef.current?.abort()}
              >
                Cancel
              </Button>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center text-center">
          <span className="flex size-12 items-center justify-center rounded-xl bg-lens-soft text-lens">
            <ImageUp className="size-6" aria-hidden />
          </span>
          <p className="mt-5 text-lg font-medium">Drop an image here</p>
          <p className="mt-1 text-sm text-muted-foreground">
            One image, up to {MAX_UPLOAD_SIZE_MB} MB
          </p>
          <Button className="mt-5" onClick={() => inputRef.current?.click()}>
            Browse files
          </Button>
          <ul className="mt-6 flex flex-wrap justify-center gap-2">
            {SUPPORTED_IMAGE_FORMATS.map((format) => (
              <li key={format.label}>
                <Badge variant="secondary" className="font-mono">
                  {format.label}
                </Badge>
              </li>
            ))}
          </ul>
        </div>
      )}
      {error ? (
        <p
          role="alert"
          className="mt-5 flex items-start justify-center gap-2 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {error}
        </p>
      ) : null}
    </div>
  )
}
