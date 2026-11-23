import { timestampToMs } from "@/lib/timestamps"
import type {
  AnalysisSummary,
  CameraSettings,
  CoverageItem,
  CoverageStatus,
  DateTimeInfo,
  DeviceInfo,
  ImageProperties,
  LocationInfo,
  Observation,
} from "@/types/analysis"
import type { MetadataIndex } from "@/server/services/metadata/normalize"

export const COMPLETENESS_DISCLAIMER =
  "Metadata completeness is an application-defined indicator, not proof of image authenticity."

const EDITOR_PATTERNS: [RegExp, string][] = [
  [/lightroom/i, "Adobe Lightroom"],
  [/photoshop/i, "Adobe Photoshop"],
  [/camera raw/i, "Adobe Camera Raw"],
  [/\bgimp\b/i, "GIMP"],
  [/snapseed/i, "Snapseed"],
  [/capture one/i, "Capture One"],
  [/affinity/i, "Affinity Photo"],
  [/darktable/i, "darktable"],
  [/rawtherapee/i, "RawTherapee"],
  [/pixelmator/i, "Pixelmator"],
  [/luminar/i, "Luminar"],
  [/\bcanva\b/i, "Canva"],
  [/picsart/i, "PicsArt"],
  [/\bvsco\b/i, "VSCO"],
  [/facetune/i, "Facetune"],
  [/paint\.net/i, "Paint.NET"],
  [/imagemagick/i, "ImageMagick"],
  [/digikam/i, "digiKam"],
]

const MINUTE = 60_000
const HOUR = 60 * MINUTE

export function detectEditingSoftware(index: MetadataIndex) {
  const names = new Set<string>()
  const values = index.fields.filter((field) =>
    [
      "Software",
      "CreatorTool",
      "ProcessingSoftware",
      "HistorySoftwareAgent",
    ].includes(field.name),
  )
  for (const field of values) {
    for (const [pattern, label] of EDITOR_PATTERNS) {
      if (pattern.test(field.value)) names.add(label)
    }
  }
  return [...names]
}

function ratio(values: unknown[]) {
  const present = values.filter(
    (value) => value !== null && value !== undefined,
  ).length
  return Math.round((present / values.length) * 100)
}

function statusFor(percent: number): CoverageStatus {
  if (percent >= 100) return "available"
  return percent > 0 ? "partial" : "missing"
}

function coverageItem(
  id: CoverageItem["id"],
  label: string,
  weight: number,
  percent: number,
): CoverageItem {
  return { id, label, weight, percent, status: statusFor(percent) }
}

export function buildCoverage(input: {
  device: DeviceInfo
  dateTime: DateTimeInfo
  camera: CameraSettings
  location: LocationInfo
  image: ImageProperties
}) {
  const { device, dateTime, camera, location, image } = input
  const capture = dateTime.original?.valid
    ? 100
    : dateTime.digitized?.valid || dateTime.modified?.valid
      ? 50
      : 0
  return [
    coverageItem(
      "device",
      "Device Information",
      25,
      ratio([device.make, device.model]),
    ),
    coverageItem("capture", "Capture Date", 25, capture),
    coverageItem(
      "camera",
      "Camera Settings",
      25,
      ratio([
        camera.exposureTime,
        camera.fNumber,
        camera.iso,
        camera.focalLength,
        camera.flash,
        camera.whiteBalance,
      ]),
    ),
    coverageItem("gps", "GPS Location", 15, location.hasGps ? 100 : 0),
    coverageItem(
      "image",
      "Image Properties",
      10,
      ratio([image.width, image.colorSpace, image.bitDepth, image.resolution]),
    ),
  ]
}

function compareTimestamps(dateTime: DateTimeInfo, now: number) {
  const observations: Observation[] = []
  const { original, digitized, modified } = dateTime

  for (const [label, stamp] of [
    ["original capture", original],
    ["digitized", digitized],
    ["modified", modified],
  ] as const) {
    if (stamp && !stamp.valid) {
      observations.push({
        code: "invalid_timestamp",
        severity: "warning",
        title: "Invalid timestamp",
        detail: `The ${label} value "${stamp.raw}" is not a valid date.`,
      })
    }
    const ms = stamp ? timestampToMs(stamp) : null
    // Timestamps without an offset could be up to 14 hours ahead of UTC.
    if (ms !== null && ms > now + 14 * HOUR) {
      observations.push({
        code: "future_timestamp",
        severity: "warning",
        title: "Timestamp in the future",
        detail: `The ${label} timestamp is later than the current date. The device clock may have been wrong.`,
      })
    }
  }

  const naive = (stamp: typeof original) =>
    stamp ? timestampToMs({ ...stamp, offset: null }) : null
  const originalMs = naive(original)
  const digitizedMs = naive(digitized)
  const modifiedMs = naive(modified)

  if (
    originalMs !== null &&
    digitizedMs !== null &&
    Math.abs(originalMs - digitizedMs) > MINUTE
  ) {
    observations.push({
      code: "timestamp_conflict",
      severity: "warning",
      title: "Capture and digitized times differ",
      detail:
        "This is normal for scanned photos, but it can also come from metadata changes.",
    })
  }
  if (originalMs !== null && modifiedMs !== null) {
    if (modifiedMs < originalMs - MINUTE) {
      observations.push({
        code: "timestamp_order",
        severity: "warning",
        title: "Modified before capture",
        detail:
          "The modification time is earlier than the capture time, which is unusual. Clock or time zone differences can cause this.",
      })
    } else if (modifiedMs > originalMs + MINUTE) {
      observations.push({
        code: "modified_after_capture",
        severity: "info",
        title: "Modified after capture",
        detail:
          "The file records a modification time later than capture. This can result from exporting, rotating, or editing.",
      })
    }
  }
  return observations
}

function checkGpsTimestamp(index: MetadataIndex, dateTime: DateTimeInfo) {
  const gps = index.field("Composite:GPSDateTime")
  const original = dateTime.original
  if (!gps || !original?.valid || !original.offset) return []
  const match = /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/.exec(
    gps.value,
  )
  const originalMs = timestampToMs(original)
  if (!match || originalMs === null) return []
  const [, y, mo, d, h, mi, s] = match
  const gpsMs = Date.UTC(
    Number(y),
    Number(mo) - 1,
    Number(d),
    Number(h),
    Number(mi),
    Number(s),
  )
  if (Math.abs(gpsMs - originalMs) <= HOUR) return []
  return [
    {
      code: "gps_time_conflict",
      severity: "warning",
      title: "GPS and camera times differ",
      detail:
        "They differ by more than one hour. A stale GPS fix or an incorrect device clock can cause this.",
    } satisfies Observation,
  ]
}

function checkValues(
  index: MetadataIndex,
  location: LocationInfo,
  image: ImageProperties,
) {
  const observations: Observation[] = []
  const number = (...keys: string[]) => {
    const raw = index.field(...keys)?.rawValue
    const value = typeof raw === "number" ? raw : Number(raw)
    return raw === undefined || raw === null || !Number.isFinite(value)
      ? null
      : value
  }
  const unusual = (detail: string) =>
    observations.push({
      code: "unusual_value",
      severity: "warning",
      title: "Unusual value",
      detail,
    })

  if (location.invalidCoordinates) {
    observations.push({
      code: "invalid_gps",
      severity: "warning",
      title: "Invalid GPS coordinates",
      detail:
        "GPS tags exist, but their values are outside the valid range, so no location is shown.",
    })
  }
  if (location.latitude === 0 && location.longitude === 0) {
    unusual(
      "GPS is exactly 0, 0. This often means the device had no real location fix.",
    )
  }
  const iso = number("EXIF:ISO")
  if (iso !== null && (iso <= 0 || iso > 3_280_000))
    unusual(`ISO value ${iso} is outside the usual range.`)
  const aperture = number("EXIF:FNumber")
  if (aperture !== null && (aperture <= 0 || aperture > 128))
    unusual(`Aperture f/${aperture} is outside the usual range.`)
  const exposure = number("EXIF:ExposureTime")
  if (exposure !== null && exposure <= 0)
    unusual("The exposure time is zero or negative.")
  const focal = number("EXIF:FocalLength")
  if (focal !== null && focal <= 0)
    unusual("The focal length is zero or negative.")

  const exifWidth = number("EXIF:ExifImageWidth")
  const exifHeight = number("EXIF:ExifImageHeight")
  if (exifWidth && exifHeight && image.width && image.height) {
    const same = exifWidth === image.width && exifHeight === image.height
    const rotated = exifWidth === image.height && exifHeight === image.width
    if (!same && !rotated) {
      observations.push({
        code: "dimension_mismatch",
        severity: "info",
        title: "Dimensions differ from EXIF",
        detail: `EXIF records ${exifWidth} × ${exifHeight}, but the image is ${image.width} × ${image.height}. Resizing or re-encoding commonly causes this.`,
      })
    }
  }
  const warning = index.text("ExifTool:Warning")
  if (warning) {
    observations.push({
      code: "parser_warning",
      severity: "warning",
      title: "Metadata parser warning",
      detail: warning,
    })
  }
  return observations
}

export function analyzeMetadata(
  index: MetadataIndex,
  input: {
    device: DeviceInfo
    dateTime: DateTimeInfo
    camera: CameraSettings
    location: LocationInfo
    image: ImageProperties
  },
  now = Date.now(),
): AnalysisSummary {
  const coverage = buildCoverage(input)
  const completeness = Math.round(
    coverage.reduce(
      (total, item) => total + (item.percent * item.weight) / 100,
      0,
    ),
  )
  const editingSoftware = detectEditingSoftware(index)
  const { device, dateTime, location } = input
  const hasExif = index.hasGroup("EXIF")
  const hasDevice = Boolean(device.make || device.model)
  const hasCapture = Boolean(dateTime.original?.valid)
  const observations: Observation[] = []
  const info = (code: string, title: string, detail: string) =>
    observations.push({ code, severity: "info", title, detail })

  if (!hasExif)
    info("missing_exif", "No EXIF metadata", "The file contains no EXIF block.")
  if (!hasDevice)
    info(
      "missing_device",
      "No device identification",
      "No camera or phone make or model is embedded.",
    )
  if (!hasCapture)
    info(
      "missing_capture",
      "No original capture time",
      "No valid original capture timestamp is embedded.",
    )
  if (!location.hasGps && !location.invalidCoordinates) {
    info("missing_gps", "No GPS location", "No GPS coordinates are embedded.")
  }
  if (!hasExif || (!hasDevice && !hasCapture)) {
    info(
      "possible_stripping",
      "Metadata may have been removed",
      "Screenshots, messaging apps, social platforms, and privacy tools often produce files like this. It does not show that the image was edited or manipulated.",
    )
  }
  if (editingSoftware.length > 0) {
    info(
      "editing_software",
      "Editing software recorded",
      `${editingSoftware.join(", ")} appears in the metadata. Such software may only have exported or organized the file.`,
    )
  }
  observations.push(
    ...compareTimestamps(dateTime, now),
    ...checkGpsTimestamp(index, dateTime),
    ...checkValues(index, location, input.image),
  )

  return {
    completeness,
    coverage,
    editingSoftware,
    observations,
    disclaimer: COMPLETENESS_DISCLAIMER,
  }
}
