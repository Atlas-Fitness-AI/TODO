"use client"

import { useMemo, type Ref } from "react"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import type { ParsedProject, Priority } from "@/lib/types"

const PRIORITIES: Priority[] = ["Critical", "High", "Medium", "Low"]

interface TaskFiltersProps {
  project: ParsedProject
  searchQuery: string
  onSearchChange: (query: string) => void
  priorityFilter: Set<Priority>
  onPriorityChange: (priorities: Set<Priority>) => void
  categoryFilter: Set<string>
  onCategoryChange: (categories: Set<string>) => void
  searchInputRef?: Ref<HTMLInputElement | null>
}

export function TaskFilters({
  project,
  searchQuery,
  onSearchChange,
  priorityFilter,
  onPriorityChange,
  categoryFilter,
  onCategoryChange,
  searchInputRef,
}: TaskFiltersProps) {
  const allCategories = useMemo(() => {
    const cats = new Set<string>()
    for (const section of project.sections) {
      for (const item of section.items) {
        for (const cat of item.category) {
          cats.add(cat)
        }
      }
    }
    return Array.from(cats).sort()
  }, [project.sections])

  function togglePriority(p: Priority) {
    const next = new Set(priorityFilter)
    if (next.has(p)) {
      next.delete(p)
    } else {
      next.add(p)
    }
    onPriorityChange(next)
  }

  function toggleCategory(c: string) {
    const next = new Set(categoryFilter)
    if (next.has(c)) {
      next.delete(c)
    } else {
      next.add(c)
    }
    onCategoryChange(next)
  }

  const hasActiveFilters = priorityFilter.size > 0 || categoryFilter.size > 0

  return (
    <div className="flex items-center gap-2">
      <Input
        ref={searchInputRef}
        placeholder="Search..."
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        className="w-20 md:w-40 h-7 text-[10px] font-mono uppercase tracking-[0.1em] placeholder:normal-case placeholder:tracking-normal"
      />
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              className={`h-7 px-2 md:px-2.5 border text-[10px] font-mono uppercase tracking-[0.15em] transition-colors inline-flex items-center gap-1 ${
                hasActiveFilters
                  ? "border-primary text-primary"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
              aria-label="Filter"
            />
          }
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="md:hidden">
            <path d="M1 2h8M2.5 5h5M4 8h2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
          <span className="hidden md:inline">Filter</span>
          {hasActiveFilters && (
            <span>{`(${priorityFilter.size + categoryFilter.size})`}</span>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={12} className="w-48">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="text-[10px] font-mono uppercase tracking-[0.15em]">
              Priority
            </DropdownMenuLabel>
            {PRIORITIES.map((p) => (
              <DropdownMenuCheckboxItem
                key={p}
                checked={priorityFilter.has(p)}
                onCheckedChange={() => togglePriority(p)}
                className="text-[11px] font-mono"
              >
                {p}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuGroup>
          {allCategories.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuLabel className="text-[10px] font-mono uppercase tracking-[0.15em]">
                  Category
                </DropdownMenuLabel>
                {allCategories.map((c) => (
                  <DropdownMenuCheckboxItem
                    key={c}
                    checked={categoryFilter.has(c)}
                    onCheckedChange={() => toggleCategory(c)}
                    className="text-[11px] font-mono"
                  >
                    {c}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuGroup>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
