"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Loader2, Sparkles } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { api } from "@/lib/api-client"
import type { ImageAnalysis } from "@/types/analysis"

export function AiPanel({
  analysis,
  preview,
}: {
  analysis: ImageAnalysis
  preview: string | null
}) {
  const client = useQueryClient()
  const { data: session } = useQuery({
    queryKey: ["session"],
    queryFn: api.session,
  })
  const run = useMutation({
    mutationFn: () => api.vision(analysis.id, preview ?? ""),
    onSuccess: (vision) => {
      client.setQueryData<ImageAnalysis>(
        ["analysis", analysis.id],
        (current) => current && { ...current, vision },
      )
    },
  })
  const { vision } = analysis

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="size-4 text-lens" aria-hidden /> AI Visual
          Observations
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          AI-generated from visible pixels and kept separate from embedded
          metadata. It may be wrong and never supplies dates, device, GPS,
          settings, or authorship.
        </p>
      </CardHeader>
      <CardContent>
        {vision ? (
          <dl className="space-y-4 text-sm">
            <div>
              <dt className="text-muted-foreground">Description</dt>
              <dd className="mt-1 leading-6">{vision.description}</dd>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">Scene</dt>
                <dd className="mt-1">
                  {vision.sceneCategory || "Not determined"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Environment</dt>
                <dd className="mt-1">
                  {vision.environment || "Not determined"}
                </dd>
              </div>
            </div>
            <div>
              <dt className="text-muted-foreground">Objects</dt>
              <dd className="mt-1 flex flex-wrap gap-1.5">
                {vision.objects.length
                  ? vision.objects.map((item) => (
                      <Badge key={item} variant="secondary">
                        {item}
                      </Badge>
                    ))
                  : "None identified"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Visible text</dt>
              <dd className="mt-1 whitespace-pre-wrap">
                {vision.visibleText.join("\n") || "None"}
              </dd>
            </div>
          </dl>
        ) : !session?.aiEnabled ? (
          <p className="text-sm text-muted-foreground">
            AI analysis is off. Set ANTHROPIC_API_KEY on the server to enable
            it.
          </p>
        ) : !preview ? (
          <p className="text-sm text-muted-foreground">
            The image preview is no longer in this browser tab. Upload the image
            again to run AI analysis.
          </p>
        ) : (
          <div>
            <p className="text-sm text-muted-foreground">
              This sends a reduced copy of the image, with metadata removed, to
              Anthropic.
            </p>
            <Button
              className="mt-3"
              onClick={() => run.mutate()}
              disabled={run.isPending}
            >
              {run.isPending ? (
                <Loader2 className="animate-spin" aria-hidden />
              ) : (
                <Sparkles aria-hidden />
              )}
              Analyze visible content
            </Button>
            {run.isError ? (
              <p role="alert" className="mt-3 text-sm text-destructive">
                {run.error.message}
              </p>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
