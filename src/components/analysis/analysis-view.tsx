"use client"

import { useMutation, useQuery } from "@tanstack/react-query"
import {
  Aperture,
  CalendarClock,
  Camera,
  CheckCircle2,
  Download,
  FileImage,
  ImageIcon,
  ImagePlus,
  ListTree,
  MapPin,
  Smartphone,
  Trash2,
  type LucideIcon,
} from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useSyncExternalStore } from "react"
import { AiPanel } from "@/components/analysis/ai-panel"
import { InfoCard } from "@/components/analysis/info-card"
import { InsightsPanel } from "@/components/analysis/insights-panel"
import { LocationPanel } from "@/components/analysis/location-panel"
import { MetadataExplorer } from "@/components/analysis/metadata-explorer"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { api, ClientApiError } from "@/lib/api-client"
import { formatBytes } from "@/lib/format"
import { getPreview, removePreview } from "@/lib/preview-store"
import type { ImageAnalysis, Timestamp } from "@/types/analysis"

const subscribe = () => () => undefined

const stampText = (stamp: Timestamp | null) => {
  if (!stamp) return null
  if (!stamp.valid) return `${stamp.raw} (invalid)`
  return [stamp.date, stamp.time, stamp.offset].filter(Boolean).join(" ")
}

function SummaryCard({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon
  label: string
  value: string | null
}) {
  return (
    <Card size="sm">
      <CardContent>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Icon className="size-3.5 text-lens" aria-hidden /> {label}
        </p>
        <p
          className={`mt-2 truncate font-semibold ${value ? "" : "text-muted-foreground"}`}
          title={value ?? undefined}
        >
          {value ?? "Not available"}
        </p>
      </CardContent>
    </Card>
  )
}

export function DashboardSkeleton() {
  return (
    <div
      className="mx-auto w-full max-w-6xl space-y-4 px-4 py-8 sm:px-6"
      role="status"
      aria-label="Loading analysis"
    >
      <Skeleton className="h-40 rounded-2xl" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <Skeleton key={item} className="h-20 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-96 rounded-2xl" />
    </div>
  )
}

function Overview({ analysis }: { analysis: ImageAnalysis }) {
  const { device, dateTime, camera, image, file } = analysis
  return (
    <div className="grid items-start gap-4 lg:grid-cols-2">
      <InfoCard
        icon={Smartphone}
        title="Device Information"
        rows={[
          { label: "Manufacturer", value: device.make },
          { label: "Model", value: device.model },
          { label: "Software", value: device.software },
          { label: "Firmware", value: device.firmware },
          { label: "Lens manufacturer", value: device.lensMake },
          { label: "Lens model", value: device.lensModel },
          {
            label: "Camera serial",
            value: device.serialNumber,
            sensitive: true,
          },
          {
            label: "Lens serial",
            value: device.lensSerialNumber,
            sensitive: true,
          },
        ]}
      />
      <div className="grid gap-4">
        <InfoCard
          icon={CalendarClock}
          title="Camera Timestamps"
          note="Recorded inside the image."
          rows={[
            {
              label: "Capture date",
              value: dateTime.original?.date ?? stampText(dateTime.original),
            },
            { label: "Capture time", value: dateTime.original?.time },
            {
              label: "Time zone",
              value: dateTime.offsetOriginal ?? dateTime.original?.offset,
            },
            { label: "Sub-second", value: dateTime.subSecOriginal },
            { label: "Digitized", value: stampText(dateTime.digitized) },
            { label: "Modified", value: stampText(dateTime.modified) },
          ]}
        />
        <InfoCard
          icon={FileImage}
          title="File Timestamps"
          note="From the file system, not the camera."
          rows={[
            { label: "File created", value: dateTime.fileCreated },
            { label: "File modified (browser)", value: dateTime.fileModified },
          ]}
        />
      </div>
      <InfoCard
        icon={Camera}
        title="Camera Settings"
        rows={[
          { label: "ISO", value: camera.iso },
          { label: "Aperture", value: camera.fNumber },
          { label: "Shutter speed", value: camera.exposureTime },
          { label: "Focal length", value: camera.focalLength },
          { label: "35 mm equivalent", value: camera.focalLength35mm },
          { label: "Flash", value: camera.flash },
          { label: "White balance", value: camera.whiteBalance },
          { label: "Exposure program", value: camera.exposureProgram },
          { label: "Exposure mode", value: camera.exposureMode },
          { label: "Metering mode", value: camera.meteringMode },
          { label: "Scene type", value: camera.sceneCaptureType },
          { label: "Orientation", value: camera.orientation },
          { label: "Digital zoom", value: camera.digitalZoomRatio },
        ]}
      />
      <InfoCard
        icon={ImageIcon}
        title="Image Properties"
        rows={[
          { label: "Filename", value: file.originalFilename },
          { label: "Extension", value: file.extension },
          { label: "MIME type", value: file.mimeType },
          {
            label: "File size",
            value: `${formatBytes(file.size)} (${file.size.toLocaleString("en-US")} bytes)`,
          },
          {
            label: "Dimensions",
            value:
              image.width && image.height
                ? `${image.width} × ${image.height}`
                : null,
          },
          { label: "Aspect ratio", value: image.aspectRatio },
          {
            label: "Total pixels",
            value: image.totalPixels?.toLocaleString("en-US"),
          },
          {
            label: "Megapixels",
            value: image.megapixels ? `${image.megapixels} MP` : null,
          },
          { label: "Resolution", value: image.resolution },
          { label: "Color space", value: image.colorSpace },
          { label: "Bit depth", value: image.bitDepth },
          { label: "Compression", value: image.compression },
          { label: "ICC profile", value: image.iccProfile },
          { label: "Alpha channel", value: image.hasAlpha },
          { label: "Embedded thumbnail", value: image.hasEmbeddedThumbnail },
        ]}
      />
    </div>
  )
}

export function AnalysisView({ id }: { id: string }) {
  const router = useRouter()
  const preview = useSyncExternalStore(
    subscribe,
    () => getPreview(id),
    () => null,
  )
  const query = useQuery({
    queryKey: ["analysis", id],
    queryFn: () => api.analysis(id),
  })
  const remove = useMutation({
    mutationFn: () => api.remove(id),
    onSuccess: () => {
      removePreview(id)
      router.push("/")
    },
  })

  if (query.isPending) return <DashboardSkeleton />
  if (query.isError) {
    const missing =
      query.error instanceof ClientApiError &&
      [400, 404].includes(query.error.status)
    return (
      <div className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center px-4 py-24 text-center">
        <Aperture className="size-8 text-muted-foreground" aria-hidden />
        <h1 className="mt-4 text-xl font-semibold">
          {missing ? "Analysis not available" : "Could not load analysis"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {missing
            ? "Temporary analyses are deleted after 30 minutes and are private to the browser that created them."
            : query.error.message}
        </p>
        <Button asChild className="mt-5">
          <Link href="/#upload">Upload an image</Link>
        </Button>
      </div>
    )
  }

  const analysis = query.data
  const { file, device, dateTime, location } = analysis
  const deviceName =
    [device.make, device.model].filter(Boolean).join(" ") || null
  const report = (format: string) => `/api/images/${id}/report?format=${format}`

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 px-4 py-8 sm:px-6">
      <Card>
        <CardContent className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <div className="flex h-44 w-full shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted sm:h-32 sm:w-44">
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={preview}
                alt={`Preview of ${file.originalFilename}`}
                className="size-full object-contain"
              />
            ) : (
              <span className="px-3 text-center text-xs text-muted-foreground">
                Preview not available
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h1
              className="truncate text-xl font-semibold tracking-tight"
              title={file.originalFilename}
            >
              {file.originalFilename}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <Badge variant="secondary" className="font-mono">
                {file.format}
              </Badge>
              <span>{formatBytes(file.size)}</span>
              <span className="flex items-center gap-1 text-foreground">
                <CheckCircle2 className="size-3.5 text-lens" aria-hidden />{" "}
                Analysis complete
              </span>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button asChild size="sm">
                <Link href="/#upload">
                  <ImagePlus aria-hidden /> Upload another image
                </Link>
              </Button>
              {(["pdf", "csv", "json"] as const).map((format) => (
                <Button key={format} asChild size="sm" variant="outline">
                  <a href={report(format)}>
                    <Download aria-hidden /> {format.toUpperCase()}
                  </a>
                </Button>
              ))}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => remove.mutate()}
                disabled={remove.isPending}
              >
                <Trash2 aria-hidden /> Delete
              </Button>
            </div>
            {remove.isError ? (
              <p role="alert" className="mt-2 text-sm text-destructive">
                {remove.error.message}
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {location.hasGps ? (
        <p className="flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
          <MapPin
            className="size-4 shrink-0 text-amber-600 dark:text-amber-400"
            aria-hidden
          />
          This image contains GPS data that may reveal where it was captured.
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryCard
          icon={Smartphone}
          label="Device Model"
          value={deviceName}
        />
        <SummaryCard
          icon={CalendarClock}
          label="Capture Date"
          value={dateTime.original?.date ?? null}
        />
        <SummaryCard
          icon={MapPin}
          label="GPS Location"
          value={
            location.hasGps
              ? `${location.latitude?.toFixed(4)}, ${location.longitude?.toFixed(4)}`
              : null
          }
        />
        <SummaryCard
          icon={ListTree}
          label="Metadata Fields Found"
          value={analysis.fields.length.toLocaleString("en-US")}
        />
      </div>

      <Tabs defaultValue="overview">
        <div className="overflow-x-auto pb-1">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="location">Location</TabsTrigger>
            <TabsTrigger value="insights">Intelligence</TabsTrigger>
            <TabsTrigger value="explorer">Metadata Explorer</TabsTrigger>
            <TabsTrigger value="ai">AI</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="overview" className="mt-3">
          <Overview analysis={analysis} />
        </TabsContent>
        <TabsContent value="location" className="mt-3">
          <LocationPanel analysis={analysis} />
        </TabsContent>
        <TabsContent value="insights" className="mt-3">
          <InsightsPanel summary={analysis.analysis} />
        </TabsContent>
        <TabsContent value="explorer" className="mt-3">
          <MetadataExplorer analysis={analysis} />
        </TabsContent>
        <TabsContent value="ai" className="mt-3">
          <AiPanel analysis={analysis} preview={preview} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
