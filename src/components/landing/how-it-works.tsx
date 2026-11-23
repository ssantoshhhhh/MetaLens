import { SectionHeading } from "@/components/landing/section-heading"

const steps = [
  {
    title: "Upload",
    body: "Add one image. Its type, signature, and size are checked first.",
  },
  {
    title: "Extract",
    body: "ExifTool reads every embedded metadata group it can find.",
  },
  {
    title: "Understand",
    body: "Explore the results, see what is missing, and download a report.",
  },
]

export function HowItWorks() {
  return (
    <section id="how-it-works" className="border-t">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <SectionHeading
          eyebrow="How it works"
          title="Three steps to the full story"
        />
        <ol className="mt-12 grid gap-8 md:grid-cols-3">
          {steps.map((step, index) => (
            <li key={step.title} className="border-t-2 border-lens pt-5">
              <span className="font-mono text-sm text-muted-foreground">
                0{index + 1}
              </span>
              <h3 className="mt-2 text-lg font-medium">{step.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {step.body}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
