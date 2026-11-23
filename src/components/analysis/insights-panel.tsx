import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  CircleMinus,
  Info,
} from "lucide-react"
import { CoverageChart } from "@/components/analysis/coverage-chart"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { AnalysisSummary, CoverageStatus } from "@/types/analysis"

const STATUS: Record<
  CoverageStatus,
  { label: string; icon: typeof CheckCircle2 }
> = {
  available: { label: "Available", icon: CheckCircle2 },
  partial: { label: "Partially Available", icon: CircleDashed },
  missing: { label: "Missing", icon: CircleMinus },
}

export function InsightsPanel({ summary }: { summary: AnalysisSummary }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Metadata Completeness</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-4xl font-semibold tracking-tight">
            {summary.completeness}%
          </p>
          <p className="mt-1 mb-5 text-xs text-muted-foreground">
            {summary.disclaimer}
          </p>
          <CoverageChart coverage={summary.coverage} />
          <ul className="mt-4 divide-y text-sm">
            {summary.coverage.map((item) => {
              const { label, icon: Icon } = STATUS[item.status]
              return (
                <li
                  key={item.id}
                  className="flex items-center justify-between gap-3 py-2"
                >
                  <span className="text-muted-foreground">{item.label}</span>
                  <span className="flex items-center gap-1.5 font-medium">
                    <Icon className="size-3.5" aria-hidden /> {label}
                  </span>
                </li>
              )
            })}
            <li className="flex items-center justify-between gap-3 py-2">
              <span className="text-muted-foreground">Editing Software</span>
              <span className="text-right font-medium">
                {summary.editingSoftware.join(", ") || "None recorded"}
              </span>
            </li>
          </ul>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Analysis Observations</CardTitle>
        </CardHeader>
        <CardContent>
          {summary.observations.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No gaps or inconsistencies were found.
            </p>
          ) : (
            <ul className="space-y-4">
              {summary.observations.map((item, index) => {
                const Icon = item.severity === "warning" ? AlertTriangle : Info
                return (
                  <li key={`${item.code}-${index}`} className="flex gap-3">
                    <Icon
                      className={`mt-0.5 size-4 shrink-0 ${item.severity === "warning" ? "text-amber-600 dark:text-amber-400" : "text-lens"}`}
                      aria-hidden
                    />
                    <div>
                      <p className="text-sm font-medium">
                        <span className="sr-only">{item.severity}: </span>
                        {item.title}
                      </p>
                      <p className="mt-0.5 text-sm leading-6 text-muted-foreground">
                        {item.detail}
                      </p>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
