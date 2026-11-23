import type { LocationInfo, Place } from "@/types/analysis"
import { ApiError } from "@/server/errors"
import type { MetadataIndex } from "@/server/services/metadata/normalize"

const toNumber = (value: unknown) => {
  if (value === null || value === undefined || value === "") return null
  const number = typeof value === "number" ? value : Number(value)
  return Number.isFinite(number) ? number : null
}

/** Applies a hemisphere reference to an unsigned or signed decimal coordinate. */
export function signedCoordinate(value: number, ref: string | null) {
  const hemisphere = ref?.trim().charAt(0).toUpperCase()
  if (hemisphere === "S" || hemisphere === "W") return -Math.abs(value)
  if (hemisphere === "N" || hemisphere === "E") return Math.abs(value)
  return value
}

function readCoordinate(
  index: MetadataIndex,
  name: "GPSLatitude" | "GPSLongitude",
) {
  const field = index.field(`EXIF:${name}`, `XMP:${name}`, `Composite:${name}`)
  const value = toNumber(field?.rawValue)
  if (value === null) return { value: null, ref: null, present: Boolean(field) }
  const refField = index.field(`EXIF:${name}Ref`, `XMP:${name}Ref`)
  const ref = refField ? String(refField.rawValue) : null
  // Composite and XMP values already carry a sign when there is no separate ref.
  return {
    value: signedCoordinate(value, ref),
    ref: refField?.value ?? ref,
    present: true,
  }
}

export function extractLocation(index: MetadataIndex): LocationInfo {
  const latitude = readCoordinate(index, "GPSLatitude")
  const longitude = readCoordinate(index, "GPSLongitude")
  const present = latitude.present || longitude.present
  const valid =
    latitude.value !== null &&
    longitude.value !== null &&
    Math.abs(latitude.value) <= 90 &&
    Math.abs(longitude.value) <= 180

  const altitudeField = index.field(
    "EXIF:GPSAltitude",
    "XMP:GPSAltitude",
    "Composite:GPSAltitude",
  )
  const altitudeValue = toNumber(altitudeField?.rawValue)
  const altitudeRefField = index.field(
    "EXIF:GPSAltitudeRef",
    "XMP:GPSAltitudeRef",
  )
  const belowSeaLevel = String(altitudeRefField?.rawValue ?? "0") === "1"
  const altitude =
    altitudeValue === null
      ? null
      : belowSeaLevel
        ? -Math.abs(altitudeValue)
        : altitudeValue

  const direction = index.text("EXIF:GPSImgDirection", "XMP:GPSImgDirection")
  const directionRef = index.text(
    "EXIF:GPSImgDirectionRef",
    "XMP:GPSImgDirectionRef",
  )

  return {
    hasGps: valid,
    invalidCoordinates: present && !valid,
    latitude: valid ? Number(latitude.value!.toFixed(7)) : null,
    longitude: valid ? Number(longitude.value!.toFixed(7)) : null,
    latitudeRef: latitude.ref,
    longitudeRef: longitude.ref,
    altitude: altitude === null ? null : Number(altitude.toFixed(2)),
    altitudeRef: altitudeRefField?.value ?? null,
    gpsDate: index.text("EXIF:GPSDateStamp", "Composite:GPSDateTime"),
    gpsTime: index.text("EXIF:GPSTimeStamp"),
    direction: direction
      ? `${direction}°${directionRef ? ` (${directionRef})` : ""}`
      : null,
    place: null,
  }
}

type NominatimResponse = {
  error?: string
  display_name?: string
  address?: Record<string, string | undefined>
}

export function mapNominatim(data: NominatimResponse): Place {
  const a = data.address ?? {}
  const street = [a.house_number, a.road].filter(Boolean).join(" ")
  return {
    displayName: data.display_name ?? null,
    country: a.country ?? null,
    state: a.state ?? a.region ?? a.province ?? null,
    city: a.city ?? a.town ?? a.village ?? a.municipality ?? a.hamlet ?? null,
    district:
      a.city_district ??
      a.district ??
      a.state_district ??
      a.county ??
      a.suburb ??
      null,
    locality: street || a.neighbourhood || a.quarter || a.suburb || null,
  }
}

// Nominatim's public policy allows at most one request per second.
const queueHolder = globalThis as typeof globalThis & {
  __mlGeocodeQueue?: Promise<unknown>
}

function throttled<T>(work: () => Promise<T>) {
  const previous = queueHolder.__mlGeocodeQueue ?? Promise.resolve()
  const next = previous.then(work, work)
  queueHolder.__mlGeocodeQueue = next
    .catch(() => undefined)
    .then(() => new Promise((resolve) => setTimeout(resolve, 1100)))
  return next
}

export async function reverseGeocode(latitude: number, longitude: number) {
  const base =
    process.env.NOMINATIM_URL ?? "https://nominatim.openstreetmap.org"
  const url = new URL("/reverse", base)
  url.search = new URLSearchParams({
    format: "jsonv2",
    lat: String(latitude),
    lon: String(longitude),
    zoom: "18",
    addressdetails: "1",
  }).toString()

  return throttled(async () => {
    let response: Response
    try {
      response = await fetch(url, {
        headers: {
          "User-Agent":
            process.env.NOMINATIM_USER_AGENT ?? "MetaLens/1.0 (self-hosted)",
          Accept: "application/json",
        },
        cache: "no-store",
        signal: AbortSignal.timeout(8_000),
      })
    } catch {
      throw new ApiError(
        502,
        "geocoding_failed",
        "The place name lookup is unavailable.",
      )
    }
    if (!response.ok) {
      throw new ApiError(
        502,
        "geocoding_failed",
        "The place name lookup is unavailable.",
      )
    }
    const data = (await response.json()) as NominatimResponse
    if (data.error) {
      throw new ApiError(
        502,
        "geocoding_failed",
        "No place was found for these coordinates.",
      )
    }
    return mapNominatim(data)
  })
}
