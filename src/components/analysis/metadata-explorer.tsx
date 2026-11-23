"use client"

import { Braces, Download, List, Search } from "lucide-react"
import { useDeferredValue, useMemo, useState } from "react"
import { CopyButton } from "@/components/analysis/copy-button"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { api } from "@/lib/api-client"
import { NOT_AVAILABLE } from "@/lib/format"
import {
  METADATA_CATEGORIES,
  type ImageAnalysis,
  type MetadataCategory,
  type MetadataField,
} from "@/types/analysis"

const STATUS_LABEL = {
  available: "Available",
  empty: "Empty",
  binary: "Binary data",
} as const

function FieldRow({ field }: { field: MetadataField }) {
  return (
    <li className="grid gap-1 py-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)_auto] sm:gap-4">
      <div className="min-w-0">
        <p className="font-mono text-xs font-medium break-all">{field.name}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{field.group}</p>
        {field.description && field.description !== field.name ? (
          <p className="mt-0.5 text-xs text-muted-foreground">
            {field.description}
          </p>
        ) : null}
      </div>
      <p className="max-h-28 min-w-0 overflow-y-auto text-sm break-words whitespace-pre-wrap">
        {field.value || <span className="text-muted-foreground">(empty)</span>}
      </p>
      <div className="flex items-center gap-1 sm:items-start">
        <Badge
          variant={field.status === "available" ? "secondary" : "outline"}
          className="text-[10px]"
        >
          {STATUS_LABEL[field.status]}
        </Badge>
        <CopyButton value={field.value} label={field.name} />
      </div>
    </li>
  )
}

export function MetadataExplorer({ analysis }: { analysis: ImageAnalysis }) {
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<MetadataCategory | "all">("all")
  const [view, setView] = useState<"fields" | "json">("fields")
  const query = useDeferredValue(search.trim().toLowerCase())

  const groups = useMemo(() => {
    const matches = analysis.fields.filter(
      (field) =>
        !query ||
        [field.name, field.value, field.group, field.description ?? ""].some(
          (text) => text.toLowerCase().includes(query),
        ),
    )
    return METADATA_CATEGORIES.filter(
      (category) => filter === "all" || category.id === filter,
    ).map((category) => ({
      ...category,
      fields: matches.filter((field) => field.category === category.id),
    }))
  }, [analysis.fields, filter, query])

  const total = groups.reduce((sum, group) => sum + group.fields.length, 0)
  const json = useMemo(
    () => (view === "json" ? JSON.stringify(analysis.raw, null, 2) : ""),
    [analysis.raw, view],
  )
  const visibleGroups = query
    ? groups.filter((group) => group.fields.length > 0)
    : groups
  const defaultOpen =
    query || filter !== "all"
      ? visibleGroups.map((group) => group.id)
      : ["exif"]

  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search
              className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search fields and values"
              aria-label="Search metadata"
              className="pl-8"
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setView(view === "fields" ? "json" : "fields")}
            >
              {view === "fields" ? (
                <Braces aria-hidden />
              ) : (
                <List aria-hidden />
              )}
              {view === "fields" ? "Raw JSON" : "Fields"}
            </Button>
            <Button
              variant="outline"
              onClick={() => api.downloadMetadata(analysis)}
            >
              <Download aria-hidden /> JSON
            </Button>
          </div>
        </div>

        {view === "json" ? (
          <div className="relative">
            <div className="absolute top-2 right-5">
              <CopyButton value={json} label="raw metadata" />
            </div>
            <pre className="max-h-[36rem] overflow-auto rounded-xl bg-muted p-4 font-mono text-xs leading-5">
              {json}
            </pre>
          </div>
        ) : (
          <>
            <div
              className="flex flex-wrap gap-1.5"
              role="group"
              aria-label="Filter by category"
            >
              {[
                { id: "all" as const, label: "All" },
                ...METADATA_CATEGORIES,
              ].map((category) => (
                <Button
                  key={category.id}
                  size="xs"
                  variant={filter === category.id ? "default" : "outline"}
                  aria-pressed={filter === category.id}
                  onClick={() => setFilter(category.id)}
                >
                  {category.label.replace(" Metadata", "")}
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground" aria-live="polite">
              {total} of {analysis.fields.length} fields
            </p>
            {query && visibleGroups.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No matching fields.
              </p>
            ) : null}
            <Accordion
              key={`${query}|${filter}`}
              type="multiple"
              defaultValue={defaultOpen}
            >
              {visibleGroups.map((group) => (
                <AccordionItem key={group.id} value={group.id}>
                  <AccordionTrigger>
                    <span className="flex items-center gap-2">
                      {group.label}
                      <Badge variant="secondary">{group.fields.length}</Badge>
                    </span>
                  </AccordionTrigger>
                  <AccordionContent>
                    {group.fields.length > 0 ? (
                      <ul className="divide-y">
                        {group.fields.map((field) => (
                          <FieldRow key={field.id} field={field} />
                        ))}
                      </ul>
                    ) : (
                      <p className="py-2 text-sm text-muted-foreground">
                        {NOT_AVAILABLE}
                      </p>
                    )}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </>
        )}
      </CardContent>
    </Card>
  )
}
