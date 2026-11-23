import {
  CalendarClock,
  Camera,
  FileDown,
  ListTree,
  MapPin,
  ScanSearch,
  type LucideIcon,
} from "lucide-react"
import { SectionHeading } from "@/components/landing/section-heading"

const features: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: Camera,
    title: "Device identification",
    body: "Make, model, lens, and firmware, only as recorded in the file.",
  },
  {
    icon: CalendarClock,
    title: "Capture timeline",
    body: "Original camera timestamps, kept separate from file-system dates.",
  },
  {
    icon: MapPin,
    title: "GPS mapping",
    body: "Embedded coordinates shown on an interactive map.",
  },
  {
    icon: ListTree,
    title: "Complete explorer",
    body: "Search every field by group, including unknown tags.",
  },
  {
    icon: ScanSearch,
    title: "Metadata intelligence",
    body: "Spot missing fields, conflicting dates, and editing software.",
  },
  {
    icon: FileDown,
    title: "Portable reports",
    body: "Export the full analysis as JSON, CSV, or PDF.",
  },
]

export function Features() {
  return (
    <section id="features" className="border-t bg-muted/40">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <SectionHeading
          eyebrow="Features"
          title="Built to report what the file actually says"
          description="MetaLens never fills gaps with guesses. If a value is not embedded, it is shown as unavailable."
        />
        <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(({ icon: Icon, title, body }) => (
            <li
              key={title}
              className="rounded-2xl border bg-card p-6 shadow-xs transition-shadow hover:shadow-md"
            >
              <Icon className="size-5 text-lens" aria-hidden />
              <h3 className="mt-4 font-medium">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {body}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
