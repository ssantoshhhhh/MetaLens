import { Features } from "@/components/landing/features"
import { Formats } from "@/components/landing/formats"
import { Hero } from "@/components/landing/hero"
import { HowItWorks } from "@/components/landing/how-it-works"
import { Privacy } from "@/components/landing/privacy"

export default function HomePage() {
  return (
    <>
      <Hero />
      <HowItWorks />
      <Features />
      <Formats />
      <Privacy />
    </>
  )
}
