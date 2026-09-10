"use client"

import type { PetKey } from "@/lib/types"

/*
 * Eight-by-eight pixel companions. Each pet is two idle frames drawn with a
 * tiny palette that maps onto theme tokens, so every pet recolors with the
 * theme. Sleep closes the eyes and floats a "z"; work adds a keyboard whose
 * keys light up under the pet's paws.
 *
 * Palette:  . transparent   f foreground   p primary   m muted   k dark eye
 */

export type PetState = "idle" | "sleep" | "work"

interface PetDef {
  name: string
  frames: [string[], string[]]
}

export const PETS: Record<PetKey, PetDef> = {
  cat: {
    name: "Pixel",
    frames: [
      [
        ".f....f.",
        ".ff..ff.",
        ".ffffff.",
        ".fkffkf.",
        ".ffpfff.",
        "..ffff..",
        "..f..f..",
        "........",
      ],
      [
        "........",
        ".f....f.",
        ".ffffff.",
        ".fkffkf.",
        ".ffpfff.",
        "..ffff..",
        "..f..f.f",
        "........",
      ],
    ],
  },
  dog: {
    name: "Bit",
    frames: [
      [
        "........",
        ".f.....f",
        ".ffffff.",
        ".fkffkf.",
        ".ffffff.",
        "..ffpf..",
        "..f..f..",
        "........",
      ],
      [
        "........",
        ".f....f.",
        ".ffffff.",
        ".fkffkf.",
        ".ffffff.",
        "..fffp..",
        "..f..f..",
        "........",
      ],
    ],
  },
  frog: {
    name: "Ping",
    frames: [
      [
        ".ff..ff.",
        ".fkffkf.",
        ".ffffff.",
        "ffffffff",
        "f.fppf.f",
        "..ffff..",
        ".f....f.",
        "........",
      ],
      [
        "........",
        ".ff..ff.",
        ".fkffkf.",
        "ffffffff",
        "f.fppf.f",
        "..ffff..",
        "ff....ff",
        "........",
      ],
    ],
  },
  octopus: {
    name: "Sudo",
    frames: [
      [
        "..ffff..",
        ".ffffff.",
        ".fkffkf.",
        ".ffpffp.",
        ".f.ff.f.",
        ".f.ff.f.",
        "f.f..f.f",
        "........",
      ],
      [
        "..ffff..",
        ".ffffff.",
        ".fkffkf.",
        ".fpffpf.",
        ".f.ff.f.",
        "f..ff..f",
        ".f.f.f.f",
        "........",
      ],
    ],
  },
  owl: {
    name: "Null",
    frames: [
      [
        ".f....f.",
        ".ffffff.",
        ".fppppf.",
        ".fpkpkf.",
        ".ffffff.",
        ".fmmmmf.",
        "..f..f..",
        "........",
      ],
      [
        ".f....f.",
        ".ffffff.",
        ".fppppf.",
        ".fkpkpf.",
        ".ffffff.",
        ".fmmmmf.",
        ".f....f.",
        "........",
      ],
    ],
  },
  snail: {
    name: "Lag",
    frames: [
      [
        ".....f.f",
        ".....kfk",
        ".pppp.ff",
        ".pmmp.ff",
        ".pmpp.ff",
        ".ppppfff",
        ".fffffff",
        "........",
      ],
      [
        "....f..f",
        ".....kfk",
        ".pppp.ff",
        ".pmmp.ff",
        ".pmpp.ff",
        ".ppppfff",
        "ffffffff",
        "........",
      ],
    ],
  },
  robot: {
    name: "Daemon",
    frames: [
      [
        "...p....",
        ".ffffff.",
        ".fkffkf.",
        ".ffffff.",
        ".fppppf.",
        ".ffffff.",
        "..f..f..",
        ".ff..ff.",
      ],
      [
        "...m....",
        ".ffffff.",
        ".fkffkf.",
        ".ffffff.",
        ".fpmmpf.",
        ".ffffff.",
        "..f..f..",
        ".ff..ff.",
      ],
    ],
  },
  dragon: {
    name: "Kernel",
    frames: [
      [
        "..f.f...",
        "..ffff..",
        "..fkfff.",
        ".fffff..",
        "ffffff..",
        ".f.ff.f.",
        "..f..f..",
        "........",
      ],
      [
        "..f.f...",
        "..ffff..",
        "..fkffpp",
        "fffff...",
        "ffffff..",
        ".f.ff.f.",
        "..f..f..",
        "........",
      ],
    ],
  },
}

export const PET_KEYS = Object.keys(PETS) as PetKey[]

const COLOR: Record<string, string> = {
  f: "var(--foreground)",
  p: "var(--primary)",
  m: "var(--muted-foreground)",
  k: "var(--background)",
}

/** Keyboard rows drawn under a working pet; keys light up on alternate frames. */
const KEYBOARD: [string[], string[]] = [
  ["mpmmmpmm", "........"],
  ["mmmpmmmp", "........"],
]

function Frame({ rows, y = 0 }: { rows: string[]; y?: number }) {
  const rects: React.ReactNode[] = []
  rows.forEach((row, r) => {
    for (let c = 0; c < row.length; c++) {
      const ch = row[c]
      if (ch === ".") continue
      rects.push(<rect key={`${r}-${c}`} x={c} y={r + y} width={1} height={1} fill={COLOR[ch]} />)
    }
  })
  return <>{rects}</>
}

function closeEyes(rows: string[]): string[] {
  return rows.map((row) => row.replace(/k/g, "m"))
}

interface PetProps {
  kind: PetKey
  state?: PetState
  /** Rendered height in pixels; the sprite is square, or taller when working. */
  size?: number
  title?: string
  className?: string
}

/** A pixel pet. Animation is pure CSS; reduced-motion users get a still frame. */
export function Pet({ kind, state = "idle", size = 24, title, className }: PetProps) {
  const def = PETS[kind]
  if (!def) return null

  const working = state === "work"
  const height = working ? 10 : 8
  const px = size / 8
  const label = title ?? `${def.name} the ${kind}`
  const period = working ? "0.5s" : state === "sleep" ? "2.4s" : "1.1s"

  const frames: string[][] = state === "sleep" ? [closeEyes(def.frames[0])] : [def.frames[0], def.frames[1]]

  return (
    <svg
      viewBox={`0 0 8 ${height}`}
      width={size}
      height={px * height}
      shapeRendering="crispEdges"
      role="img"
      aria-label={label}
      className={className}
    >
      <title>{label}</title>
      {frames.map((rows, i) => (
        <g
          key={i}
          className="pet-frame"
          style={
            frames.length > 1
              ? { animation: `pet-frames ${period} steps(1) infinite`, animationDelay: `${(-i * parseFloat(period)) / 2}s` }
              : undefined
          }
        >
          <Frame rows={rows} />
          {working && <Frame rows={KEYBOARD[i % 2]} y={8} />}
        </g>
      ))}
      {state === "sleep" && (
        <g className="pet-zzz" style={{ animation: "pet-zzz 2.4s ease-out infinite" }}>
          <rect x={6} y={0} width={1} height={1} fill="var(--muted-foreground)" />
          <rect x={7} y={-1} width={1} height={1} fill="var(--muted-foreground)" />
        </g>
      )}
    </svg>
  )
}

export function petName(kind: PetKey | null | undefined): string | null {
  return kind ? PETS[kind]?.name ?? null : null
}
