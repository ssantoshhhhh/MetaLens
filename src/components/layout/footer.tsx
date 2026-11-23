import { Logo } from "@/components/brand/logo"

export function Footer() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <Logo />
        <p className="text-sm text-muted-foreground">
          Metadata can be edited or removed, so it is not proof of authenticity.
        </p>
      </div>
    </footer>
  )
}
