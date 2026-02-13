"use client"

import { useTheme } from "next-themes"
import { useEffect, useRef } from "react"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

const THEMES = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
] as const

const COOKIE_MAX_AGE = 60 * 60 * 24 * 365

interface ThemeToggleProps {
  defaultTheme?: string
}

export function ThemeToggle({ defaultTheme = "system" }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme()
  const initialized = useRef(false)

  // After hydration, sync cookie whenever theme changes
  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true
      return
    }
    if (theme) {
      document.cookie = `theme=${theme}; path=/; max-age=${COOKIE_MAX_AGE}`
    }
  }, [theme])

  // Use server-known default until next-themes hydrates
  const current = theme ?? defaultTheme

  return (
    <ToggleGroup
      variant="outline"
      size="sm"
      value={[current]}
      onValueChange={(newValue) => {
        if (newValue.length > 0) {
          const selected = newValue[newValue.length - 1]
          setTheme(selected)
          document.cookie = `theme=${selected}; path=/; max-age=${COOKIE_MAX_AGE}`
        }
      }}
    >
      {THEMES.map((t) => (
        <ToggleGroupItem
          key={t.value}
          value={t.value}
          pressed={current === t.value}
          className="text-[10px] uppercase tracking-[0.15em] aria-pressed:bg-primary aria-pressed:text-primary-foreground"
        >
          {t.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
