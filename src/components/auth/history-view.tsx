"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { History, MapPin, Search, Trash2 } from "lucide-react"
import Link from "next/link"
import { useDeferredValue, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { api } from "@/lib/api-client"
import { formatBytes } from "@/lib/format"

export function HistoryView() {
  const client = useQueryClient()
  const [search, setSearch] = useState("")
  const term = useDeferredValue(search.trim())
  const { data: session, isPending: sessionPending } = useQuery({
    queryKey: ["session"],
    queryFn: api.session,
  })
  const history = useQuery({
    queryKey: ["history", term],
    queryFn: () => api.history(term),
    enabled: Boolean(session?.user),
    staleTime: 0,
  })
  const remove = useMutation({
    mutationFn: api.remove,
    onSuccess: () => client.invalidateQueries({ queryKey: ["history"] }),
  })

  if (!sessionPending && !session?.user) {
    return (
      <div className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center px-4 py-24 text-center">
        <History className="size-8 text-muted-foreground" aria-hidden />
        <h1 className="mt-4 text-xl font-semibold">Sign in to view history</h1>
        <Button asChild className="mt-5">
          <Link href="/login">Sign in</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-5 px-4 py-10 sm:px-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Analysis History
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Only metadata you chose to save is listed. Original images are never
          stored.
        </p>
      </div>
      <div className="relative">
        <Search
          className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by filename or device"
          aria-label="Search history"
          className="pl-8"
        />
      </div>
      {history.isPending || sessionPending ? (
        <div className="space-y-2">
          {[0, 1, 2].map((item) => (
            <Skeleton key={item} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : history.isError ? (
        <p role="alert" className="text-sm text-destructive">
          {history.error.message}
        </p>
      ) : history.data.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          {term ? "No matching analyses." : "No saved analyses yet."}
        </p>
      ) : (
        <ul className="space-y-2">
          {history.data.map((item) => (
            <li key={item.id}>
              <Card size="sm">
                <CardContent className="flex items-center justify-between gap-3">
                  <Link
                    href={`/analysis/${item.id}`}
                    className="min-w-0 flex-1 hover:underline"
                  >
                    <p className="truncate font-medium">
                      {item.originalFilename}
                    </p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                      <span>{item.imageFormat}</span>
                      <span>{formatBytes(item.fileSize)}</span>
                      <span>
                        {[item.deviceMake, item.deviceModel]
                          .filter(Boolean)
                          .join(" ") || "Unknown device"}
                      </span>
                      {item.captureDate ? (
                        <span>Captured {item.captureDate}</span>
                      ) : null}
                      {item.hasGps ? (
                        <span className="flex items-center gap-0.5">
                          <MapPin className="size-3" aria-hidden /> GPS
                        </span>
                      ) : null}
                    </p>
                  </Link>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Delete ${item.originalFilename}`}
                    disabled={remove.isPending}
                    onClick={() => remove.mutate(item.id)}
                  >
                    <Trash2 aria-hidden />
                  </Button>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
