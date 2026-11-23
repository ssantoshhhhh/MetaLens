import { ArrowDown } from "lucide-react"
import { UploadPanel } from "@/components/landing/upload-panel"
import { Button } from "@/components/ui/button"
import { siteConfig } from "@/config/site"

export function Hero() {
  return (
    <section id="top" className="relative overflow-hidden">
      <div aria-hidden className="absolute inset-0 -z-10 hero-grid" />
      <div className="mx-auto max-w-6xl px-4 pt-16 pb-20 sm:px-6 sm:pt-24">
        <div className="mx-auto max-w-3xl animate-in text-center duration-700 fade-in slide-in-from-bottom-3">
          <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
            Discover Everything Hidden Inside Your Images.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-pretty text-muted-foreground">
            {siteConfig.description}
          </p>
          <Button asChild size="lg" className="mt-8">
            <a href="#upload">
              Analyze Image
              <ArrowDown aria-hidden />
            </a>
          </Button>
        </div>
        <div className="mt-14">
          <UploadPanel />
        </div>
      </div>
    </section>
  )
}
