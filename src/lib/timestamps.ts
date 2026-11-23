import type { Timestamp } from "@/types/analysis"

const PATTERN =
  /^(\d{4})[:-](\d{2})[:-](\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?)?\s*(Z|[+-]\d{2}:?\d{2})?$/

export function parseTimestamp(
  raw: string,
  source: string,
  fallbackOffset: string | null = null,
): Timestamp {
  const match = PATTERN.exec(raw.trim())
  const invalid: Timestamp = {
    raw,
    date: null,
    time: null,
    offset: null,
    valid: false,
    source,
  }
  if (!match) return invalid

  const [, y, mo, d, h, mi, s, zone] = match
  const year = Number(y)
  const month = Number(mo)
  const day = Number(d)
  const hour = Number(h ?? 0)
  const minute = Number(mi ?? 0)
  const second = Number(s ?? 0)
  const probe = new Date(Date.UTC(year, month - 1, day, hour, minute, second))
  const realDate =
    year > 0 &&
    probe.getUTCFullYear() === year &&
    probe.getUTCMonth() === month - 1 &&
    probe.getUTCDate() === day &&
    hour < 24 &&
    minute < 60 &&
    second < 60
  if (!realDate) return invalid

  return {
    raw,
    date: `${y}-${mo}-${d}`,
    time: h ? `${h}:${mi}:${s ?? "00"}` : null,
    offset: normalizeOffset(zone ?? fallbackOffset),
    valid: true,
    source,
  }
}

function normalizeOffset(offset: string | null | undefined) {
  if (!offset) return null
  if (offset === "Z") return "+00:00"
  return offset.includes(":")
    ? offset
    : `${offset.slice(0, 3)}:${offset.slice(3)}`
}

function offsetMinutes(offset: string) {
  const sign = offset.startsWith("-") ? -1 : 1
  const [hours = "0", minutes = "0"] = offset.slice(1).split(":")
  return sign * (Number(hours) * 60 + Number(minutes))
}

/** Epoch ms, treating a missing offset as UTC. Use only for like-for-like comparison. */
export function timestampToMs(timestamp: Timestamp): number | null {
  if (!timestamp.valid || !timestamp.date) return null
  const iso = `${timestamp.date}T${timestamp.time ?? "00:00:00"}Z`
  const ms = Date.parse(iso)
  if (Number.isNaN(ms)) return null
  return timestamp.offset ? ms - offsetMinutes(timestamp.offset) * 60_000 : ms
}
