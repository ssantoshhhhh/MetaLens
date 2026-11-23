"use client"

import { Moon, Sun } from "lucide-react"
import { Button } from "@/components/ui/button"
import { THEME_STORAGE_KEY } from "@/components/theme/theme-script"

function toggleTheme() {
  const isDark = document.documentElement.classList.toggle("dark")
  try {
    localStorage.setItem(THEME_STORAGE_KEY, isDark ? "dark" : "light")
  } catch {
    // Storage can be unavailable; the theme still applies for this page view.
  }
}

export function ThemeToggle() {
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      aria-label="Toggle color theme"
    >
      <Sun className="hidden size-4 dark:block" aria-hidden />
      <Moon className="size-4 dark:hidden" aria-hidden />
    </Button>
  )
}
