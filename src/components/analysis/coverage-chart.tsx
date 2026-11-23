"use client"

import {
  Bar,
  BarChart,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import type { CoverageItem } from "@/types/analysis"

type TooltipProps = {
  active?: boolean
  payload?: readonly { payload: CoverageItem }[]
}

function CoverageTooltip({ active, payload }: TooltipProps) {
  const item = payload?.[0]?.payload
  if (!active || !item) return null
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
      <p className="font-medium">{item.label}</p>
      <p className="text-muted-foreground">
        {item.percent}% found · {item.weight}% of score
      </p>
    </div>
  )
}

export function CoverageChart({ coverage }: { coverage: CoverageItem[] }) {
  return (
    <div
      className="h-52 w-full"
      role="img"
      aria-label={`Metadata coverage: ${coverage.map((item) => `${item.label} ${item.percent}%`).join(", ")}`}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={coverage}
          layout="vertical"
          margin={{ top: 0, right: 40, bottom: 0, left: 0 }}
        >
          <XAxis type="number" domain={[0, 100]} hide />
          <YAxis
            type="category"
            dataKey="label"
            width={126}
            tickLine={false}
            axisLine={false}
            tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
          />
          <Tooltip
            cursor={{ fill: "var(--muted)", opacity: 0.5 }}
            content={<CoverageTooltip />}
          />
          <Bar
            dataKey="percent"
            fill="var(--lens)"
            barSize={12}
            radius={[0, 4, 4, 0]}
            background={{ fill: "var(--muted)", radius: 4 }}
            isAnimationActive={false}
          >
            <LabelList
              dataKey="percent"
              position="right"
              offset={8}
              formatter={(value) => `${String(value)}%`}
              style={{ fill: "var(--foreground)", fontSize: 12 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
