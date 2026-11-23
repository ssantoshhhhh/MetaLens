export type JsonValue =
  string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }

export const METADATA_CATEGORIES = [
  { id: "exif", label: "EXIF Metadata" },
  { id: "gps", label: "GPS Metadata" },
  { id: "iptc", label: "IPTC Metadata" },
  { id: "xmp", label: "XMP Metadata" },
  { id: "file", label: "File System Metadata" },
  { id: "camera", label: "Camera Metadata" },
  { id: "image", label: "Image Properties" },
  { id: "software", label: "Software and Editing" },
  { id: "other", label: "Other Embedded Metadata" },
] as const

export type MetadataCategory = (typeof METADATA_CATEGORIES)[number]["id"]
export type FieldStatus = "available" | "empty" | "binary"

export type MetadataField = {
  id: string
  name: string
  value: string
  rawValue: JsonValue
  group: string
  category: MetadataCategory
  description: string | null
  status: FieldStatus
}

export type FileDetails = {
  originalFilename: string
  extension: string
  mimeType: string
  format: string
  size: number
  /** Reported by the browser. Not read from the image. */
  clientLastModified: string | null
}

export type DeviceInfo = {
  make: string | null
  model: string | null
  software: string | null
  firmware: string | null
  hostComputer: string | null
  lensMake: string | null
  lensModel: string | null
  serialNumber: string | null
  lensSerialNumber: string | null
}

export type Timestamp = {
  raw: string
  date: string | null
  time: string | null
  offset: string | null
  valid: boolean
  source: string
}

export type DateTimeInfo = {
  original: Timestamp | null
  digitized: Timestamp | null
  modified: Timestamp | null
  subSecOriginal: string | null
  offsetOriginal: string | null
  fileCreated: string | null
  fileModified: string | null
}

export type Place = {
  displayName: string | null
  country: string | null
  state: string | null
  city: string | null
  district: string | null
  locality: string | null
}

export type LocationInfo = {
  hasGps: boolean
  invalidCoordinates: boolean
  latitude: number | null
  longitude: number | null
  latitudeRef: string | null
  longitudeRef: string | null
  altitude: number | null
  altitudeRef: string | null
  gpsDate: string | null
  gpsTime: string | null
  direction: string | null
  place: Place | null
}

export type CameraSettings = {
  exposureTime: string | null
  fNumber: string | null
  iso: string | null
  focalLength: string | null
  focalLength35mm: string | null
  flash: string | null
  whiteBalance: string | null
  exposureProgram: string | null
  exposureMode: string | null
  meteringMode: string | null
  sceneCaptureType: string | null
  orientation: string | null
  digitalZoomRatio: string | null
}

export type ImageProperties = {
  width: number | null
  height: number | null
  aspectRatio: string | null
  megapixels: number | null
  totalPixels: number | null
  resolution: string | null
  colorSpace: string | null
  bitDepth: string | null
  compression: string | null
  orientation: string | null
  iccProfile: string | null
  hasAlpha: boolean | null
  hasEmbeddedThumbnail: boolean
}

export type CoverageStatus = "available" | "partial" | "missing"

export type CoverageItem = {
  id: "device" | "capture" | "camera" | "gps" | "image"
  label: string
  status: CoverageStatus
  percent: number
  weight: number
}

export type ObservationSeverity = "info" | "warning"

export type Observation = {
  code: string
  severity: ObservationSeverity
  title: string
  detail: string
}

export type AnalysisSummary = {
  completeness: number
  coverage: CoverageItem[]
  editingSoftware: string[]
  observations: Observation[]
  disclaimer: string
}

export type VisionResult = {
  description: string
  objects: string[]
  sceneCategory: string
  environment: string
  visibleText: string[]
  model: string
  generatedAt: string
}

export type ImageAnalysis = {
  id: string
  createdAt: string
  expiresAt: string | null
  savedToHistory: boolean
  file: FileDetails
  device: DeviceInfo
  dateTime: DateTimeInfo
  location: LocationInfo
  camera: CameraSettings
  image: ImageProperties
  fields: MetadataField[]
  raw: Record<string, JsonValue>
  analysis: AnalysisSummary
  vision: VisionResult | null
}

export type HistoryItem = {
  id: string
  originalFilename: string
  imageFormat: string
  fileSize: number
  deviceMake: string | null
  deviceModel: string | null
  captureDate: string | null
  hasGps: boolean
  createdAt: string
}

export type SessionState = {
  authEnabled: boolean
  aiEnabled: boolean
  user: { id: string; name: string; email: string } | null
}
