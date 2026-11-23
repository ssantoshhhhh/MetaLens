import type { Metadata } from "next"
import { Suspense } from "react"
import {
  AnalysisView,
  DashboardSkeleton,
} from "@/components/analysis/analysis-view"

export const metadata: Metadata = {
  title: "Analysis – MetaLens",
  robots: { index: false, follow: false },
}

async function ResolvedAnalysis({
  params,
}: {
  params: PageProps<"/analysis/[id]">["params"]
}) {
  const { id } = await params
  return <AnalysisView id={id} />
}

export default function AnalysisPage({ params }: PageProps<"/analysis/[id]">) {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <ResolvedAnalysis params={params} />
    </Suspense>
  )
}
