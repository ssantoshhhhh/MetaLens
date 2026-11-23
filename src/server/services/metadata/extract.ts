import { parseTimestamp } from "@/lib/timestamps"
import type {
  CameraSettings,
  DateTimeInfo,
  DeviceInfo,
  Timestamp,
} from "@/types/analysis"
import type { MetadataIndex } from "@/server/services/metadata/normalize"

const both = (name: string) => [`EXIF:${name}`, `XMP:${name}`]

export function extractDevice(index: MetadataIndex): DeviceInfo {
  return {
    make: index.text(...both("Make")),
    model: index.text(...both("Model")),
    software: index.text("EXIF:Software", "XMP:CreatorTool"),
    firmware: index.text(
      "MakerNotes:FirmwareVersion",
      "EXIF:FirmwareVersion",
      "XMP:Firmware",
    ),
    hostComputer: index.text("EXIF:HostComputer"),
    lensMake: index.text(...both("LensMake")),
    lensModel: index.text(
      "EXIF:LensModel",
      "Composite:LensID",
      "XMP:LensModel",
      "XMP:Lens",
      "MakerNotes:LensModel",
      "MakerNotes:LensType",
    ),
    serialNumber: index.text(
      "EXIF:SerialNumber",
      "MakerNotes:SerialNumber",
      "MakerNotes:InternalSerialNumber",
      "XMP:SerialNumber",
    ),
    lensSerialNumber: index.text(
      "EXIF:LensSerialNumber",
      "MakerNotes:LensSerialNumber",
      "XMP:LensSerialNumber",
    ),
  }
}

function timestampFrom(
  index: MetadataIndex,
  keys: string[],
  fallbackOffset: string | null,
): Timestamp | null {
  const field = index.field(...keys)
  return field ? parseTimestamp(field.value, field.id, fallbackOffset) : null
}

export function extractDateTime(
  index: MetadataIndex,
  clientLastModified: string | null,
): DateTimeInfo {
  const offsetOriginal = index.text("EXIF:OffsetTimeOriginal")
  return {
    original: timestampFrom(
      index,
      ["EXIF:DateTimeOriginal", "XMP:DateTimeOriginal", "XMP:DateCreated"],
      offsetOriginal,
    ),
    digitized: timestampFrom(
      index,
      ["EXIF:CreateDate", "XMP:CreateDate"],
      index.text("EXIF:OffsetTimeDigitized"),
    ),
    modified: timestampFrom(
      index,
      ["EXIF:ModifyDate", "XMP:ModifyDate"],
      index.text("EXIF:OffsetTime"),
    ),
    subSecOriginal: index.text("EXIF:SubSecTimeOriginal"),
    offsetOriginal,
    // Browsers do not expose a file's creation time.
    fileCreated: null,
    fileModified: clientLastModified,
  }
}

export function extractCamera(index: MetadataIndex): CameraSettings {
  const exposure = index.text(...both("ExposureTime"))
  const fNumber = index.text(...both("FNumber"))
  return {
    exposureTime: exposure ? `${exposure} sec` : null,
    fNumber: fNumber ? `f/${fNumber}` : null,
    iso: index.text(
      "EXIF:ISO",
      "XMP:ISO",
      "XMP:ISOSpeedRatings",
      "MakerNotes:ISO",
    ),
    focalLength: index.text(...both("FocalLength")),
    focalLength35mm: index.text(...both("FocalLengthIn35mmFormat")),
    flash: index.text("EXIF:Flash", "XMP:Flash", "Composite:Flash"),
    whiteBalance: index.text(...both("WhiteBalance")),
    exposureProgram: index.text(...both("ExposureProgram")),
    exposureMode: index.text(...both("ExposureMode")),
    meteringMode: index.text(...both("MeteringMode")),
    sceneCaptureType: index.text(...both("SceneCaptureType")),
    orientation: index.text(...both("Orientation")),
    digitalZoomRatio: index.text(...both("DigitalZoomRatio")),
  }
}
