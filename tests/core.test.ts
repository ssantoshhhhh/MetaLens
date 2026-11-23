import { describe, expect, it } from "vitest"
import { detectImageFormat } from "@/lib/image-signature"
import { aspectRatio, formatBytes, safeDownloadName } from "@/lib/format"
import { parseTimestamp, timestampToMs } from "@/lib/timestamps"
import {
  createSessionToken,
  hashPassword,
  verifyPassword,
  verifySessionToken,
} from "@/server/auth/session"
import { ApiError } from "@/server/errors"
import { analyzeMetadata } from "@/server/services/analysis"
import { buildImageProperties } from "@/server/services/image"
import {
  extractLocation,
  mapNominatim,
  signedCoordinate,
} from "@/server/services/location"
import {
  extractCamera,
  extractDateTime,
  extractDevice,
} from "@/server/services/metadata/extract"
import {
  categorizeField,
  MetadataIndex,
  normalizeMetadata,
} from "@/server/services/metadata/normalize"
import { csvCell } from "@/server/services/report"
import { sanitizeFilename, validateUpload } from "@/server/services/upload"
import { parseVisionPayload } from "@/server/services/vision"

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0])
const PNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0,
])
const heic = new Uint8Array([
  0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63, 0, 0, 0, 0, 0x6d,
  0x69, 0x66, 0x31, 0x68, 0x65, 0x69, 0x63,
])

const context = {
  tempPath: "/tmp/x/abc.jpg",
  originalFilename: "photo.jpg",
  clientLastModified: null,
}
const indexOf = (record: Record<string, unknown>) =>
  new MetadataIndex(normalizeMetadata(record, context).fields)
const code = (work: () => unknown) => {
  try {
    work()
  } catch (error) {
    return (error as ApiError).code
  }
  return null
}

describe("upload validation", () => {
  it("detects formats from file signatures", () => {
    expect(detectImageFormat(JPEG)).toBe("jpeg")
    expect(detectImageFormat(PNG)).toBe("png")
    expect(detectImageFormat(heic)).toBe("heic")
    expect(
      detectImageFormat(new TextEncoder().encode("<svg></svg>")),
    ).toBeNull()
  })
  it("rejects spoofed files", () => {
    expect(
      code(() =>
        validateUpload({
          filename: "a.jpg",
          declaredMime: "image/jpeg",
          bytes: PNG,
        }),
      ),
    ).toBe("signature_mismatch")
    expect(
      code(() =>
        validateUpload({
          filename: "a.jpg",
          declaredMime: "text/html",
          bytes: JPEG,
        }),
      ),
    ).toBe("mime_mismatch")
    expect(
      code(() =>
        validateUpload({ filename: "a.exe", declaredMime: "", bytes: JPEG }),
      ),
    ).toBe("unsupported_format")
    expect(
      code(() =>
        validateUpload({
          filename: "a.jpg",
          declaredMime: "",
          bytes: new Uint8Array(),
        }),
      ),
    ).toBe("empty_file")
  })
  it("strips paths and control characters", () => {
    expect(sanitizeFilename("../../etc/pa\u0000ss.jpg")).toBe("pass.jpg")
    expect(sanitizeFilename("C:\\x\\y.png")).toBe("y.png")
  })
})

describe("timestamps", () => {
  it("parses EXIF and offsets", () => {
    const stamp = parseTimestamp("2024:05:01 10:20:30", "EXIF", "+05:30")
    expect(stamp).toMatchObject({
      date: "2024-05-01",
      time: "10:20:30",
      offset: "+05:30",
      valid: true,
    })
    expect(timestampToMs(stamp)).toBe(Date.UTC(2024, 4, 1, 4, 50, 30))
  })
  it("rejects impossible dates", () => {
    expect(parseTimestamp("0000:00:00 00:00:00", "EXIF").valid).toBe(false)
    expect(parseTimestamp("2024:02:31 10:00:00", "EXIF").valid).toBe(false)
  })
})

describe("GPS", () => {
  it("applies hemisphere references", () => {
    expect(signedCoordinate(33.8, "S")).toBe(-33.8)
    expect(signedCoordinate(151.2, "West")).toBe(-151.2)
    expect(signedCoordinate(10, "N")).toBe(10)
  })
  it("reads southern and western coordinates and negative altitude", () => {
    const location = extractLocation(
      indexOf({
        "EXIF:GPS:GPSLatitudeRef": { val: "South", num: "S" },
        "EXIF:GPS:GPSLatitude": { val: "33 deg", num: 33.8688 },
        "EXIF:GPS:GPSLongitudeRef": { val: "West", num: "W" },
        "EXIF:GPS:GPSLongitude": { val: "70 deg", num: 70.25 },
        "EXIF:GPS:GPSAltitudeRef": { val: "Below Sea Level", num: 1 },
        "EXIF:GPS:GPSAltitude": { val: "12 m", num: 12 },
      }),
    )
    expect(location).toMatchObject({
      hasGps: true,
      latitude: -33.8688,
      longitude: -70.25,
      altitude: -12,
    })
  })
  it("never reports out-of-range coordinates", () => {
    const location = extractLocation(
      indexOf({
        "EXIF:GPS:GPSLatitude": { val: "200", num: 200 },
        "EXIF:GPS:GPSLongitude": { val: "10", num: 10 },
      }),
    )
    expect(location).toMatchObject({
      hasGps: false,
      invalidCoordinates: true,
      latitude: null,
    })
  })
  it("maps partial geocoder responses", () => {
    expect(
      mapNominatim({ address: { country: "France", town: "Nice" } }),
    ).toMatchObject({ country: "France", city: "Nice", state: null })
  })
})

describe("normalization", () => {
  it("preserves unknown tags and removes temp-file details", () => {
    const { fields } = normalizeMetadata(
      {
        SourceFile: "/tmp/x/abc.jpg",
        "File:System:Directory": { val: "/tmp/x" },
        "File:System:FileModifyDate": { val: "2026:01:01" },
        "Vendor:Mystery:Unknown_0x1234": { val: "keep" },
        "ExifTool:Warning": { val: "bad /tmp/x/abc.jpg" },
      },
      context,
    )
    expect(fields.map((field) => field.name)).toContain("Unknown_0x1234")
    expect(
      fields.find((field) => field.name === "Unknown_0x1234")?.category,
    ).toBe("other")
    expect(
      fields.some(
        (field) =>
          field.name === "Directory" || field.name === "FileModifyDate",
      ),
    ).toBe(false)
    expect(JSON.stringify(fields)).not.toContain("/tmp/x")
  })
  it("categorizes groups", () => {
    expect(categorizeField("EXIF", "GPS", "GPSLatitude")).toBe("gps")
    expect(categorizeField("EXIF", "IFD0", "Software")).toBe("software")
    expect(categorizeField("MakerNotes", "Canon", "LensType")).toBe("camera")
    expect(categorizeField("IPTC", "IPTC", "Keywords")).toBe("iptc")
  })
})

describe("analysis", () => {
  const run = (record: Record<string, unknown>) => {
    const index = indexOf(record)
    return analyzeMetadata(
      index,
      {
        device: extractDevice(index),
        dateTime: extractDateTime(index, null),
        camera: extractCamera(index),
        location: extractLocation(index),
        image: buildImageProperties(index, null),
      },
      Date.UTC(2026, 0, 1),
    )
  }
  const codes = (record: Record<string, unknown>) =>
    run(record).observations.map((item) => item.code)

  it("reports stripped files without claiming manipulation", () => {
    const summary = run({ "File:FileType": { val: "JPEG" } })
    expect(summary.completeness).toBe(0)
    expect(summary.observations.map((item) => item.code)).toContain(
      "possible_stripping",
    )
    const text = summary.observations.find(
      (item) => item.code === "possible_stripping",
    )?.detail
    expect(text).toContain("does not show")
  })
  it("detects editors but ignores firmware versions", () => {
    expect(
      run({ "EXIF:IFD0:Software": { val: "Adobe Lightroom 7.1" } })
        .editingSoftware,
    ).toEqual(["Adobe Lightroom"])
    expect(
      run({ "EXIF:IFD0:Software": { val: "18.1" } }).editingSoftware,
    ).toEqual([])
  })
  it("flags timestamp conflicts and future dates", () => {
    expect(
      codes({
        "EXIF:ExifIFD:DateTimeOriginal": { val: "2024:05:01 10:00:00" },
        "EXIF:ExifIFD:CreateDate": { val: "2024:05:03 10:00:00" },
        "EXIF:IFD0:ModifyDate": { val: "2024:04:01 10:00:00" },
      }),
    ).toEqual(expect.arrayContaining(["timestamp_conflict", "timestamp_order"]))
    expect(
      codes({
        "EXIF:ExifIFD:DateTimeOriginal": { val: "2030:01:01 00:00:00" },
      }),
    ).toContain("future_timestamp")
    expect(
      codes({
        "EXIF:ExifIFD:DateTimeOriginal": { val: "0000:00:00 00:00:00" },
      }),
    ).toContain("invalid_timestamp")
  })
})

describe("reports and security", () => {
  it("neutralizes spreadsheet formulas", () => {
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`)
    expect(csvCell("@cmd")).toBe(`"'@cmd"`)
    expect(csvCell("Apple")).toBe('"Apple"')
  })
  it("creates safe names and display values", () => {
    expect(safeDownloadName('a"b\r\nc.jpg', "report.pdf")).toBe(
      "a-b-c-report.pdf",
    )
    expect(aspectRatio(4032, 3024)).toBe("4:3")
    expect(formatBytes(2048)).toBe("2.0 KB")
  })
  it("verifies passwords and rejects forged or expired sessions", async () => {
    process.env.AUTH_SECRET = "x".repeat(40)
    const hash = await hashPassword("correct horse battery")
    expect(await verifyPassword("correct horse battery", hash)).toBe(true)
    expect(await verifyPassword("wrong", hash)).toBe(false)
    const token = createSessionToken("user-1", 1000)
    expect(verifySessionToken(token, 2000)).toBe("user-1")
    expect(verifySessionToken(`${token}x`, 2000)).toBeNull()
    expect(verifySessionToken(token, 1000 + 8 * 24 * 3600 * 1000)).toBeNull()
  })
  it("keeps only expected AI fields", () => {
    const parsed = parseVisionPayload(
      '{"description":"A dog","objects":["dog",1],"gps":"1,2"}',
    )
    expect(parsed.objects).toEqual(["dog"])
    expect(parsed).not.toHaveProperty("gps")
  })
})
