import { Aperture } from "lucide-react"
import Link from "next/link"
import { siteConfig } from "@/config/site"

export function Logo() {
  return (
    <Link
      href="/"
      className="inline-flex items-center gap-2 rounded-md font-semibold tracking-tight"
    >
      <Aperture className="size-5 text-lens" aria-hidden />
      {siteConfig.name}
    </Link>
  )
}
