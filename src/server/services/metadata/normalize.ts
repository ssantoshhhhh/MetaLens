import type {
  FieldStatus,
  JsonValue,
  MetadataCategory,
  MetadataField,
} from "@/types/analysis"

const SOFTWARE_TAGS = new Set([
  "Software",
  "CreatorTool",
  "ProcessingSoftware",
  "HistorySoftwareAgent",
  "HistoryAction",
  "HistoryWhen",
  "HistoryParameters",
  "HistoryChanged",
  "HistoryInstanceID",
])
const IMAGE_GROUPS = new Set([
  "File",
  "JFIF",
  "PNG",
  "ICC_Profile",
  "RIFF",
  "GIF",
  "BMP",
  "APP14",
  "Adobe",
  "QuickTime",
  "JPEG",
])
const IMAGE_COMPOSITES = new Set(["ImageSize", "Megapixels"])

export function categorizeField(
  family0: string,
  family1: string,
  name: string,
): MetadataCategory {
  if (name.startsWith("GPS") || family1 === "GPS") return "gps"
  if (
    SOFTWARE_TAGS.has(name) ||
    family0 === "Photoshop" ||
    ["XMP-crs", "XMP-photoshop", "XMP-xmpMM"].includes(family1)
  ) {
    return "software"
  }
  if (family0 === "File" && family1 === "System") return "file"
  if (IMAGE_GROUPS.has(family0)) return "image"
  if (family0 === "Composite")
    return IMAGE_COMPOSITES.has(name) ? "image" : "camera"
  if (family0 === "MakerNotes") return "camera"
  if (family0 === "EXIF") return "exif"
  if (family0 === "IPTC") return "iptc"
  if (family0 === "XMP") return "xmp"
  return "other"
}

function stringifyValue(value: unknown): string {
  if (value === null || value === undefined) return ""
  if (Array.isArray(value)) return value.map(stringifyValue).join(", ")
  if (typeof value === "object") return JSON.stringify(value)
  return String(value)
}

function statusOf(text: string): FieldStatus {
  if (/^\(Binary data \d+ bytes/.test(text)) return "binary"
  return text.trim() === "" ? "empty" : "available"
}

function parseKey(key: string) {
  const parts = key.split(":")
  const family0 = parts[0] ?? "Other"
  const name = parts.at(-1) ?? key
  const middle = parts.slice(1, -1).filter((part) => !/^Copy\d+$/.test(part))
  return { family0, family1: middle[0] ?? family0, name }
}

function isLongEntry(
  value: unknown,
): value is { val: unknown; num?: unknown; desc?: unknown } {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    "val" in value
  )
}

export type NormalizeContext = {
  tempPath: string
  originalFilename: string
  clientLastModified: string | null
}

/** Converts ExifTool output to fields, replacing all temp-file details. Nothing else is dropped. */
export function normalizeMetadata(
  record: Record<string, unknown>,
  context: NormalizeContext,
) {
  const fields: MetadataField[] = []
  const raw: Record<string, JsonValue> = {}
  const scrub = (text: string) =>
    text
      .replaceAll(context.tempPath, context.originalFilename)
      .replaceAll(
        context.tempPath.split("/").at(-1) ?? context.tempPath,
        context.originalFilename,
      )

  const add = (
    key: string,
    value: string,
    rawValue: JsonValue,
    description: string | null,
  ) => {
    const { family0, family1, name } = parseKey(key)
    fields.push({
      id: key,
      name,
      value,
      rawValue,
      group: family1 === family0 ? family0 : `${family0} / ${family1}`,
      category: categorizeField(family0, family1, name),
      description,
      status: statusOf(value),
    })
    raw[key] = rawValue
  }

  add(
    "File:System:FileName",
    context.originalFilename,
    context.originalFilename,
    "Uploaded file name",
  )

  for (const [key, entry] of Object.entries(record)) {
    if (key === "SourceFile") continue
    // These describe MetaLens's temp copy, not the user's original file.
    if (key.startsWith("File:System:") && !key.endsWith(":FileSize")) continue

    const long = isLongEntry(entry)
    const value = scrub(stringifyValue(long ? entry.val : entry))
    const numeric = long ? entry.num : undefined
    const rawValue = (numeric ??
      (long ? entry.val : entry) ??
      null) as JsonValue
    const safeRaw = typeof rawValue === "string" ? scrub(rawValue) : rawValue
    const description =
      long && typeof entry.desc === "string" ? entry.desc : null
    add(key, value, safeRaw, description)
  }

  if (context.clientLastModified) {
    add(
      "File:System:BrowserReportedModifyDate",
      context.clientLastModified,
      context.clientLastModified,
      "File modification time reported by the browser. Not embedded in the image.",
    )
  }
  return { fields, raw }
}

export class MetadataIndex {
  private readonly byKey = new Map<string, MetadataField>()

  constructor(readonly fields: MetadataField[]) {
    for (const field of fields) {
      const family0 = field.id.split(":")[0] ?? ""
      const key = `${family0}:${field.name}`
      if (!this.byKey.has(key)) this.byKey.set(key, field)
    }
  }

  field(...keys: string[]) {
    for (const key of keys) {
      const field = this.byKey.get(key)
      if (field && field.status === "available") return field
    }
    return null
  }

  text(...keys: string[]) {
    return this.field(...keys)?.value ?? null
  }

  hasGroup(family0: string) {
    return this.fields.some((field) => field.id.startsWith(`${family0}:`))
  }
}
