import { Check, ShieldCheck } from "lucide-react"
import { SectionHeading } from "@/components/landing/section-heading"

const commitments = [
  "Your image is read in your browser. Its extracted metadata is sent to the server for analysis and not kept by default.",
  "Embedded metadata is treated as data and never executed.",
  "Temporary results stay in your browser tab and expire after 30 minutes. Saved results are private to your account.",
  "The map and place lookup run only when you ask, because they send coordinates to OpenStreetMap.",
]

export function Privacy() {
  return (
    <section id="privacy" className="border-t bg-muted/40">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-2">
        <div>
          <ShieldCheck className="mb-5 size-7 text-lens" aria-hidden />
          <SectionHeading
            eyebrow="Privacy"
            title="Your photos can reveal more than you think"
            description="GPS metadata may reveal exactly where an image was captured. Check before you share it."
          />
        </div>
        <ul className="space-y-4 self-center">
          {commitments.map((item) => (
            <li key={item} className="flex gap-3 text-sm leading-6">
              <Check className="mt-1 size-4 shrink-0 text-lens" aria-hidden />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
