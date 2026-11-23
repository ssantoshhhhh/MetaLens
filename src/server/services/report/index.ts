import path from "node:path"
import PDFDocument from "pdfkit"
import { formatBytes, NOT_AVAILABLE } from "@/lib/format"
import { METADATA_CATEGORIES, type ImageAnalysis } from "@/types/analysis"

export const REPORT_FORMATS = ["json", "csv", "pdf"] as const
export type ReportFormat = (typeof REPORT_FORMATS)[number]

type Row = [label: string, value: string | number | boolean | null | undefined]
type Section = { title: string; rows: Row[] }

const display = (value: Row[1]) => {
  if (value === null || value === undefined || value === "")
    return NOT_AVAILABLE
  if (typeof value === "boolean") return value ? "Yes" : "No"
  return String(value)
}

const stamp = (value: ImageAnalysis["dateTime"]["original"]) => {
  if (!value) return null
  if (!value.valid) return `${value.raw} (invalid)`
  return [value.date, value.time, value.offset].filter(Boolean).join(" ")
}

export function reportSections(analysis: ImageAnalysis): Section[] {
  const { file, device, dateTime, location, camera, image } = analysis
  return [
    {
      title: "Uploaded Image",
      rows: [
        ["Filename", file.originalFilename],
        ["Format", file.format],
        ["MIME type", file.mimeType],
        ["File size", formatBytes(file.size)],
      ],
    },
    {
      title: "Device Information",
      rows: [
        ["Manufacturer", device.make],
        ["Model", device.model],
        ["Software", device.software],
        ["Firmware", device.firmware],
        ["Lens manufacturer", device.lensMake],
        ["Lens model", device.lensModel],
        ["Camera serial number", device.serialNumber],
        ["Lens serial number", device.lensSerialNumber],
      ],
    },
    {
      title: "Date and Time",
      rows: [
        ["Original capture (camera)", stamp(dateTime.original)],
        ["Digitized (camera)", stamp(dateTime.digitized)],
        ["Modified (metadata)", stamp(dateTime.modified)],
        ["Sub-second", dateTime.subSecOriginal],
        ["Time zone offset", dateTime.offsetOriginal],
        ["File created (file system)", dateTime.fileCreated],
        ["File modified (browser-reported)", dateTime.fileModified],
      ],
    },
    {
      title: "GPS Information",
      rows: [
        ["Latitude", location.latitude],
        ["Longitude", location.longitude],
        ["Altitude (m)", location.altitude],
        ["GPS date", location.gpsDate],
        ["GPS time", location.gpsTime],
        ["Image direction", location.direction],
        ["Place", location.place?.displayName],
      ],
    },
    {
      title: "Camera Settings",
      rows: [
        ["ISO", camera.iso],
        ["Aperture", camera.fNumber],
        ["Shutter speed", camera.exposureTime],
        ["Focal length", camera.focalLength],
        ["Focal length (35 mm)", camera.focalLength35mm],
        ["Flash", camera.flash],
        ["White balance", camera.whiteBalance],
        ["Exposure program", camera.exposureProgram],
        ["Exposure mode", camera.exposureMode],
        ["Metering mode", camera.meteringMode],
        ["Scene type", camera.sceneCaptureType],
        ["Orientation", camera.orientation],
        ["Digital zoom", camera.digitalZoomRatio],
      ],
    },
    {
      title: "Image Properties",
      rows: [
        [
          "Dimensions",
          image.width && image.height
            ? `${image.width} × ${image.height}`
            : null,
        ],
        ["Aspect ratio", image.aspectRatio],
        ["Total pixels", image.totalPixels],
        ["Megapixels", image.megapixels],
        ["Resolution", image.resolution],
        ["Color space", image.colorSpace],
        ["Bit depth", image.bitDepth],
        ["Compression", image.compression],
        ["ICC profile", image.iccProfile],
        ["Alpha channel", image.hasAlpha],
        ["Embedded thumbnail", image.hasEmbeddedThumbnail],
      ],
    },
    {
      title: "Metadata Availability",
      rows: [
        ["Metadata completeness", `${analysis.analysis.completeness}%`],
        ...analysis.analysis.coverage.map((item): Row => [
          item.label,
          `${item.status} (${item.percent}%)`,
        ]),
        [
          "Editing software",
          analysis.analysis.editingSoftware.join(", ") || null,
        ],
      ],
    },
  ]
}

/** Prevents spreadsheet formula injection from attacker-controlled metadata. */
export function csvCell(value: unknown) {
  let text = value === null || value === undefined ? "" : String(value)
  if (/^[\s]*[=+\-@\t\r]/.test(text)) text = `'${text}`
  return `"${text.replaceAll('"', '""')}"`
}

export function toCsv(analysis: ImageAnalysis) {
  const rows: unknown[][] = [
    ["Section", "Group", "Field", "Value", "Status", "Description"],
  ]
  for (const section of reportSections(analysis)) {
    for (const [label, value] of section.rows) {
      rows.push([
        section.title,
        "Summary",
        label,
        display(value),
        value === null || value === undefined ? "missing" : "available",
        "",
      ])
    }
  }
  for (const observation of analysis.analysis.observations) {
    rows.push([
      "Analysis Observations",
      observation.severity,
      observation.title,
      observation.detail,
      "",
      "",
    ])
  }
  if (analysis.vision) {
    rows.push([
      "AI Visual Observations",
      "AI-generated, not metadata",
      "Description",
      analysis.vision.description,
      "",
      "",
    ])
  }
  for (const field of analysis.fields) {
    const category = METADATA_CATEGORIES.find(
      (item) => item.id === field.category,
    )?.label
    rows.push([
      category,
      field.group,
      field.name,
      field.value,
      field.status,
      field.description,
    ])
  }
  return `﻿${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`
}

export function toJsonReport(analysis: ImageAnalysis) {
  return JSON.stringify(
    {
      report: "MetaLens Image Metadata Report",
      generatedAt: new Date().toISOString(),
      notice: analysis.analysis.disclaimer,
      ...analysis,
    },
    null,
    2,
  )
}

const FONT_DIR = path.join(process.cwd(), "node_modules/dejavu-fonts-ttf/ttf")
const COLORS = {
  ink: "#171717",
  muted: "#6b6b6b",
  line: "#e2e2e2",
  accent: "#0f766e",
}
const MAX_PDF_VALUE = 320

export function toPdf(analysis: ImageAnalysis): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 54, bottom: 54, left: 48, right: 48 },
      bufferPages: true,
      info: { Title: "MetaLens Metadata Report", Creator: "MetaLens" },
    })
    const chunks: Buffer[] = []
    doc.on("data", (chunk: Buffer) => chunks.push(chunk))
    doc.on("end", () => resolve(Buffer.concat(chunks)))
    doc.on("error", reject)
    doc.registerFont("Body", path.join(FONT_DIR, "DejaVuSans.ttf"))
    doc.registerFont("Bold", path.join(FONT_DIR, "DejaVuSans-Bold.ttf"))

    const left = doc.page.margins.left
    const width = doc.page.width - left - doc.page.margins.right
    const labelWidth = 170
    const bottom = () => doc.page.height - doc.page.margins.bottom

    const heading = (title: string) => {
      if (doc.y + 56 > bottom()) doc.addPage()
      doc.moveDown(0.9).font("Bold").fontSize(12).fillColor(COLORS.ink)
      doc.text(title, left, doc.y, { width })
      const y = doc.y + 3
      doc
        .moveTo(left, y)
        .lineTo(left + width, y)
        .lineWidth(0.7)
        .strokeColor(COLORS.accent)
        .stroke()
      doc.y = y + 7
    }
    const row = (label: string, raw: string) => {
      const value =
        raw.length > MAX_PDF_VALUE
          ? `${raw.slice(0, MAX_PDF_VALUE)}… (full value in JSON report)`
          : raw
      doc.font("Body").fontSize(8.5)
      const height = Math.max(
        doc.heightOfString(label, { width: labelWidth - 8 }),
        doc.heightOfString(value, { width: width - labelWidth }),
      )
      if (doc.y + height + 5 > bottom()) doc.addPage()
      const y = doc.y
      doc
        .fillColor(COLORS.muted)
        .text(label, left, y, { width: labelWidth - 8 })
      doc.fillColor(value === NOT_AVAILABLE ? COLORS.muted : COLORS.ink)
      doc.text(value, left + labelWidth, y, { width: width - labelWidth })
      doc.y = y + height + 4
      doc.x = left
    }

    doc.font("Bold").fontSize(22).fillColor(COLORS.ink).text("MetaLens")
    doc
      .font("Body")
      .fontSize(10)
      .fillColor(COLORS.muted)
      .text("Image Metadata Report")
    doc
      .fontSize(8.5)
      .text(`Generated ${new Date().toISOString()}  ·  Analysis ${analysis.id}`)
    doc.moveDown(0.5).fillColor(COLORS.accent).font("Body").fontSize(8.5)
    doc.text(analysis.analysis.disclaimer, { width })

    for (const section of reportSections(analysis)) {
      heading(section.title)
      for (const [label, value] of section.rows) row(label, display(value))
    }

    heading("Analysis Observations")
    if (analysis.analysis.observations.length === 0)
      row("Result", "No observations.")
    for (const observation of analysis.analysis.observations) {
      row(observation.title, observation.detail)
    }

    if (analysis.vision) {
      heading("AI Visual Observations (AI-generated, not metadata)")
      row("Description", analysis.vision.description)
      row("Scene", analysis.vision.sceneCategory)
      row("Environment", analysis.vision.environment)
      row("Objects", analysis.vision.objects.join(", ") || "None")
      row("Visible text", analysis.vision.visibleText.join(" | ") || "None")
    }

    for (const category of METADATA_CATEGORIES) {
      const fields = analysis.fields.filter(
        (field) => field.category === category.id,
      )
      if (fields.length === 0) continue
      heading(`${category.label} (${fields.length})`)
      for (const field of fields)
        row(`${field.name}\n${field.group}`, field.value || "(empty)")
    }

    const range = doc.bufferedPageRange()
    for (let page = 0; page < range.count; page += 1) {
      doc.switchToPage(range.start + page)
      const y = doc.page.height - 34
      const savedBottom = doc.page.margins.bottom
      doc.page.margins.bottom = 0
      doc.font("Body").fontSize(7.5).fillColor(COLORS.muted)
      doc.text(
        `Contains potentially sensitive metadata  ·  Page ${page + 1} of ${range.count}`,
        left,
        y,
        {
          width,
          align: "center",
          lineBreak: false,
        },
      )
      doc.page.margins.bottom = savedBottom
    }
    doc.end()
  })
}
