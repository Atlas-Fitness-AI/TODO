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

export type PetState = "idle" | "sleep" | "work" | "away"

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
  penguin: {
    name: "Waddle",
    frames: [
      [
        "..ffff..",
        ".ffffff.",
        ".fkffkf.",
        ".ffppff.",
        ".fmmmmf.",
        ".fmmmmf.",
        "f.ffff.f",
        "..pp.pp.",
      ],
      [
        "..ffff..",
        ".ffffff.",
        ".fkffkf.",
        ".ffppff.",
        "ffmmmmff",
        ".fmmmmf.",
        "..ffff..",
        "..pp.pp.",
      ],
    ],
  },
  ghost: {
    name: "Boo",
    frames: [
      [
        "..ffff..",
        ".ffffff.",
        ".fkffkf.",
        ".ffffff.",
        ".ffpfff.",
        ".ffffff.",
        ".ffffff.",
        ".f.ff.f.",
      ],
      [
        "........",
        "..ffff..",
        ".ffffff.",
        ".fkffkf.",
        ".ffffff.",
        ".ffpfff.",
        ".ffffff.",
        "f.f..f.f",
      ],
    ],
  },
  crab: {
    name: "Pinch",
    frames: [
      [
        ".p....p.",
        "pp.ff.pp",
        ".ffffff.",
        ".fkffkf.",
        ".ffffff.",
        "ffffffff",
        ".f.ff.f.",
        "f......f",
      ],
      [
        "p......p",
        "pp.ff.pp",
        ".ffffff.",
        ".fkffkf.",
        ".ffffff.",
        "ffffffff",
        "f.f..f.f",
        "........",
      ],
    ],
  },
  bat: {
    name: "Echo",
    frames: [
      [
        "f......f",
        "ff.ff.ff",
        "ffffffff",
        ".fkffkf.",
        "..ffff..",
        "..fppf..",
        "..f..f..",
        "........",
      ],
      [
        "........",
        "f.ffff.f",
        "ffffffff",
        ".fkffkf.",
        "f.ffff.f",
        "..fppf..",
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
  const away = state === "away"
  const height = working || away ? 10 : 8
  const px = size / 8
  const label = title ?? `${def.name} the ${kind}`
  const period = working ? "0.5s" : state === "sleep" || away ? "2.4s" : "1.1s"

  const frames: string[][] =
    state === "sleep" || away ? [closeEyes(def.frames[0]), closeEyes(def.frames[1])] : [def.frames[0], def.frames[1]]
  // Away: still at the keyboard, but no keys light up.
  const keyboard: [string[], string[]] = away ? [["mmmmmmmm", "........"], ["mmmmmmmm", "........"]] : KEYBOARD

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
              ? {
                  animationName: "pet-frames",
                  animationDuration: period,
                  animationTimingFunction: "steps(1)",
                  animationIterationCount: "infinite",
                  animationDelay: `${(-i * parseFloat(period)) / 2}s`,
                }
              : undefined
          }
        >
          <Frame rows={rows} />
          {(working || away) && <Frame rows={keyboard[i % 2]} y={8} />}
        </g>
      ))}
      {(state === "sleep" || away) && (
        <g
          className="pet-zzz"
          style={{ animationName: "pet-zzz", animationDuration: "2.4s", animationTimingFunction: "ease-out", animationIterationCount: "infinite" }}
        >
          <rect x={6} y={0} width={1} height={1} fill="var(--primary)" />
          <rect x={7} y={-1} width={1} height={1} fill="var(--primary)" opacity={0.6} />
        </g>
      )}
    </svg>
  )
}

export function petName(kind: PetKey | null | undefined): string | null {
  return kind ? PETS[kind]?.name ?? null : null
}
