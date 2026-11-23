"use client"

import "leaflet/dist/leaflet.css"
import { useEffect, useRef } from "react"

export function LeafletMap({
  latitude,
  longitude,
}: {
  latitude: number
  longitude: number
}) {
  const container = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let disposed = false
    let cleanup: (() => void) | undefined
    void import("leaflet").then(({ default: L }) => {
      if (disposed || !container.current) return
      const map = L.map(container.current, { scrollWheelZoom: false }).setView(
        [latitude, longitude],
        15,
      )
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap contributors",
      }).addTo(map)
      const icon = L.divIcon({
        className: "",
        html: '<span style="display:block;width:18px;height:18px;border-radius:50%;background:#0f766e;border:3px solid #fff;box-shadow:0 1px 5px rgb(0 0 0 / 45%)"></span>',
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      })
      L.marker([latitude, longitude], {
        icon,
        title: "Embedded GPS location",
        alt: "Embedded GPS location",
      }).addTo(map)
      cleanup = () => map.remove()
    })
    return () => {
      disposed = true
      cleanup?.()
    }
  }, [latitude, longitude])
  return (
    <div
      ref={container}
      role="application"
      aria-label="Map of the embedded GPS location"
      className="isolate z-0 h-80 w-full rounded-xl border"
    />
  )
}
