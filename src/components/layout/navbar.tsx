import Link from "next/link"
import { SessionNav } from "@/components/auth/session-nav"
import { Logo } from "@/components/brand/logo"
import { ThemeToggle } from "@/components/theme/theme-toggle"
import { Button } from "@/components/ui/button"
import { siteConfig } from "@/config/site"

export function Navbar() {
  return (
    <header className="sticky top-0 z-[1100] border-b glass">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 px-4 sm:px-6">
        <Logo />
        <nav aria-label="Primary" className="hidden items-center gap-7 lg:flex">
          {siteConfig.nav.map((item) => (
            <Link
              key={item.href}
              href={`/${item.href}`}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-1 sm:gap-2">
          <SessionNav />
          <ThemeToggle />
          <Button asChild size="sm" className="hidden sm:inline-flex">
            <Link href="/#upload">Analyze Image</Link>
          </Button>
        </div>
      </div>
    </header>
  )
}
