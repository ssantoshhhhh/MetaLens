"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import {
  ExternalLink,
  Loader2,
  MapPin,
  MapPinOff,
  ShieldAlert,
} from "lucide-react"
import dynamic from "next/dynamic"
import { useState } from "react"
import { CopyButton } from "@/components/analysis/copy-button"
import { InfoCard } from "@/components/analysis/info-card"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { api } from "@/lib/api-client"
import { NOT_AVAILABLE } from "@/lib/format"
import type { ImageAnalysis } from "@/types/analysis"

const LeafletMap = dynamic(
  () =>
    import("@/components/analysis/leaflet-map").then(
      (module) => module.LeafletMap,
    ),
  {
    ssr: false,
    loading: () => <Skeleton className="h-80 w-full rounded-xl" />,
  },
)

export function LocationPanel({ analysis }: { analysis: ImageAnalysis }) {
  const client = useQueryClient()
  const { location, id } = analysis
  const [mapEnabled, setMapEnabled] = useState(Boolean(location.place))
  const geocode = useMutation({
    mutationFn: () => api.geocode(id),
    onSuccess: (place) => {
      client.setQueryData<ImageAnalysis>(
        ["analysis", id],
        (current) =>
          current && { ...current, location: { ...current.location, place } },
      )
    },
  })

  if (
    !location.hasGps ||
    location.latitude === null ||
    location.longitude === null
  ) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center py-12 text-center">
          <MapPinOff className="size-8 text-muted-foreground" aria-hidden />
          <p className="mt-4 font-medium">
            {location.invalidCoordinates
              ? "GPS values are invalid"
              : "No GPS location"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{NOT_AVAILABLE}</p>
        </CardContent>
      </Card>
    )
  }

  const coordinates = `${location.latitude}, ${location.longitude}`
  const osm = `https://www.openstreetmap.org/?mlat=${location.latitude}&mlon=${location.longitude}#map=16/${location.latitude}/${location.longitude}`
  const place = location.place

  return (
    <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
      <Card>
        <CardContent className="space-y-4">
          {mapEnabled ? (
            <>
              <LeafletMap
                latitude={location.latitude}
                longitude={location.longitude}
              />
              {geocode.isError ? (
                <p role="alert" className="text-sm text-destructive">
                  {geocode.error.message} Coordinates remain available.
                </p>
              ) : null}
            </>
          ) : (
            <div className="flex h-80 flex-col items-center justify-center rounded-xl border border-dashed bg-muted/40 p-6 text-center">
              <ShieldAlert className="size-7 text-lens" aria-hidden />
              <p className="mt-3 font-medium">This image reveals a location</p>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Loading the map and place name sends these coordinates to
                OpenStreetMap services.
              </p>
              <Button
                className="mt-4"
                onClick={() => {
                  setMapEnabled(true)
                  geocode.mutate()
                }}
              >
                <MapPin aria-hidden /> Load map and place name
              </Button>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <code className="rounded-md bg-muted px-2 py-1 font-mono text-xs">
              {coordinates}
            </code>
            <CopyButton value={coordinates} label="coordinates" />
            <Button asChild variant="outline" size="sm">
              <a href={osm} target="_blank" rel="noopener noreferrer">
                OpenStreetMap <ExternalLink aria-hidden />
              </a>
            </Button>
            {geocode.isPending ? (
              <Loader2
                className="size-4 animate-spin text-muted-foreground"
                aria-label="Looking up place"
              />
            ) : null}
          </div>
        </CardContent>
      </Card>
      <div className="space-y-4">
        <InfoCard
          icon={MapPin}
          title="GPS Details"
          rows={[
            { label: "Latitude", value: location.latitude },
            { label: "Longitude", value: location.longitude },
            {
              label: "Altitude",
              value:
                location.altitude === null ? null : `${location.altitude} m`,
            },
            { label: "GPS date", value: location.gpsDate },
            { label: "GPS time (UTC)", value: location.gpsTime },
            { label: "Direction", value: location.direction },
          ]}
        />
        {place ? (
          <InfoCard
            icon={MapPin}
            title="Place"
            note="From reverse geocoding, not embedded in the image."
            rows={[
              { label: "Country", value: place.country },
              { label: "State", value: place.state },
              { label: "City", value: place.city },
              { label: "District", value: place.district },
              { label: "Street or locality", value: place.locality },
            ]}
          />
        ) : null}
      </div>
    </div>
  )
}
