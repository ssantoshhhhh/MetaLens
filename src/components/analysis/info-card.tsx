"use client"

import { Eye, EyeOff, type LucideIcon } from "lucide-react"
import { useState } from "react"
import { CopyButton } from "@/components/analysis/copy-button"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { NOT_AVAILABLE } from "@/lib/format"

export type InfoRow = {
  label: string
  value: string | number | boolean | null | undefined
  sensitive?: boolean
}

function text(value: InfoRow["value"]) {
  if (value === null || value === undefined || value === "") return null
  if (typeof value === "boolean") return value ? "Yes" : "No"
  return String(value)
}

function Row({ row }: { row: InfoRow }) {
  const [revealed, setRevealed] = useState(false)
  const value = text(row.value)
  return (
    <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] items-start gap-3 py-2 text-sm">
      <dt className="text-muted-foreground">{row.label}</dt>
      <dd className="flex min-w-0 items-start justify-between gap-1">
        {value ? (
          <>
            <span className="min-w-0 font-medium break-words">
              {row.sensitive && !revealed ? "••••••••" : value}
            </span>
            {row.sensitive ? (
              <span className="-my-1 flex shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  onClick={() => setRevealed(!revealed)}
                  aria-label={
                    revealed ? `Hide ${row.label}` : `Reveal ${row.label}`
                  }
                >
                  {revealed ? (
                    <EyeOff className="size-3.5" aria-hidden />
                  ) : (
                    <Eye className="size-3.5" aria-hidden />
                  )}
                </Button>
              </span>
            ) : (
              <span className="-my-1">
                <CopyButton value={value} label={row.label} />
              </span>
            )}
          </>
        ) : (
          <span className="text-xs leading-5 text-muted-foreground">
            {NOT_AVAILABLE}
          </span>
        )}
      </dd>
    </div>
  )
}

export function InfoCard({
  icon: Icon,
  title,
  note,
  rows,
}: {
  icon: LucideIcon
  title: string
  note?: string
  rows: InfoRow[]
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="size-4 text-lens" aria-hidden />
          {title}
        </CardTitle>
        {note ? <p className="text-xs text-muted-foreground">{note}</p> : null}
      </CardHeader>
      <CardContent>
        <dl className="divide-y">
          {rows.map((row) => (
            <Row key={row.label} row={row} />
          ))}
        </dl>
      </CardContent>
    </Card>
  )
}
