import { SectionHeading } from "@/components/landing/section-heading"
import { METADATA_STANDARDS } from "@/config/upload"

export function Formats() {
  return (
    <section id="formats" className="border-t">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <SectionHeading
          eyebrow="Supported metadata"
          title="Every major metadata standard"
        />
        <dl className="mt-12 grid gap-px overflow-hidden rounded-2xl border bg-border sm:grid-cols-2 lg:grid-cols-3">
          {METADATA_STANDARDS.map((standard) => (
            <div key={standard.name} className="bg-card p-6">
              <dt className="font-mono text-sm font-medium">{standard.name}</dt>
              <dd className="mt-1 text-sm text-muted-foreground">
                {standard.detail}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}
