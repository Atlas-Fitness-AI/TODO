"use client"

import { useTheme } from "next-themes"
import { useEffect, useRef } from "react"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu"

const THEMES = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "tokyo", label: "Tokyo" },
  { value: "crt", label: "CRT" },
  { value: "rose", label: "Rosé" },
  { value: "synth", label: "Synth" },
  { value: "ember", label: "Ember" },
  { value: "dawn", label: "Dawn" },
  { value: "abyss", label: "Abyss" },
] as const

const COOKIE_MAX_AGE = 60 * 60 * 24 * 365

interface ThemeToggleProps {
  defaultTheme?: string
}

function ThemeIcon({ theme }: { theme: string }) {
  if (theme === "light") {
    return (
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <circle cx="6" cy="6" r="2.5" fill="currentColor" />
        <path
          d="M6 0.5V2M6 10V11.5M11.5 6H10M2 6H0.5M9.9 2.1L8.8 3.2M3.2 8.8L2.1 9.9M9.9 9.9L8.8 8.8M3.2 3.2L2.1 2.1"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
      </svg>
    )
  }
  if (theme === "tokyo") {
    return (
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.2" />
        <path d="M6 1.5A4.5 4.5 0 0 1 6 10.5Z" fill="currentColor" />
      </svg>
    )
  }
  if (theme === "dawn") {
    return (
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <path
          d="M3.5 8.5a2.5 2.5 0 0 1 5 0M6 2.5V4M2.2 4.2l1 1M9.8 4.2l-1 1M1 8.5h10"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
      </svg>
    )
  }
  if (theme === "abyss") {
    // Sonar ping: a point of light and two rings fading into the deep.
    return (
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <circle cx="6" cy="6" r="1.3" fill="currentColor" />
        <path d="M2.8 6a3.2 3.2 0 0 1 3.2-3.2" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
        <path d="M6 9.2A3.2 3.2 0 0 1 2.8 6" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" opacity="0.55" />
        <path d="M1 6a5 5 0 0 1 5-5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" opacity="0.7" />
        <path d="M6 11a5 5 0 0 1-5-5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" opacity="0.3" />
      </svg>
    )
  }
  if (theme === "ember") {
    return (
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <path
          d="M6 1c.5 2.2-2.8 3.6-2.8 6.2a2.8 2.8 0 0 0 5.6 0C8.8 4.6 5.5 3.2 6 1Z"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
        <path d="M6 10.5a1.6 1.6 0 0 1-1.1-2.8C5.4 7.2 6 6.6 6 6c0 .6.6 1.2 1.1 1.7A1.6 1.6 0 0 1 6 10.5Z" fill="currentColor" />
      </svg>
    )
  }
  if (theme === "synth") {
    return (
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <path d="M2 7a4 4 0 0 1 8 0Z" fill="currentColor" />
        <path
          d="M1 8.5h10M3 10.5h6"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
      </svg>
    )
  }
  if (theme === "rose") {
    return (
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <path
          d="M6 1L8.8 5.2H7.3L10 9.5H2L4.7 5.2H3.2L6 1Z"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
        <path d="M6 9.5v2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    )
  }
  if (theme === "crt") {
    return (
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <rect x="1" y="2" width="10" height="7" stroke="currentColor" strokeWidth="1.2" />
        <path d="M4 11h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    )
  }
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path
        d="M10 7.5A4.5 4.5 0 1 1 4.5 2a3.5 3.5 0 0 0 5.5 5.5Z"
        fill="currentColor"
      />
    </svg>
  )
}

export function ThemeToggle({ defaultTheme = "tokyo" }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme()
  const initialized = useRef(false)

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true
      // Migrate theme values persisted by older sessions (system, dim)
      if (theme && !THEMES.some((t) => t.value === theme)) {
        setTheme("tokyo")
        document.cookie = `theme=tokyo; path=/; max-age=${COOKIE_MAX_AGE}`
      }
      return
    }
    if (theme) {
      document.cookie = `theme=${theme}; path=/; max-age=${COOKIE_MAX_AGE}`
    }
  }, [theme, setTheme])

  const current = theme ?? defaultTheme

  function applyTheme(value: string) {
    setTheme(value)
    document.cookie = `theme=${value}; path=/; max-age=${COOKIE_MAX_AGE}`
  }

  const currentLabel = THEMES.find((t) => t.value === current)?.label ?? current

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            className="h-7 flex items-center gap-2 px-2 text-muted-foreground hover:text-primary border-2 border-border hover:border-primary/50 transition-colors"
            aria-label="Theme"
          />
        }
      >
        <ThemeIcon theme={current} />
        <span className="hidden md:inline text-[10px] uppercase tracking-[0.15em]">
          {currentLabel}
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-36">
        <DropdownMenuRadioGroup
          value={current}
          onValueChange={(value) => applyTheme(value)}
        >
          {THEMES.map((t) => (
            <DropdownMenuRadioItem
              key={t.value}
              value={t.value}
              className="text-[11px] font-mono uppercase tracking-[0.15em]"
            >
              <span className="flex items-center gap-2">
                <ThemeIcon theme={t.value} />
                {t.label}
              </span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
