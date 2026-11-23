import { GitHubIcon } from "@/components/brand/github-icon"
import { Logo } from "@/components/brand/logo"
import { siteConfig } from "@/config/site"

export function Footer() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <Logo />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
          <p className="text-sm text-muted-foreground">
            Metadata can be edited or removed, so it is not proof of
            authenticity.
          </p>
          <a
            href={siteConfig.repositoryUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium transition-colors hover:text-lens"
          >
            <GitHubIcon className="size-4" />
            View on GitHub
          </a>
        </div>
      </div>
    </footer>
  )
}
