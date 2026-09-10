"use client"

/*
 * Fathom, the TODO mascot. A sixteen-by-sixteen anglerfish reserved for the
 * brand: not one of the pets anyone can pick. The lure pulses.
 */

const ROWS = ["................", "....pp..........", "...pppp.........", "....pp..........", "......f.........", ".......f........", "......ffffff....", "....ffffffffff..", "...ffkfffffffff.", "..ffffffffffffff", ".f.kkkkfffffff.f", ".fkfkfkffffffff.", "...ffffffffff...", ".....fffff......", "................", "................"]

const HALO: [number, number][] = [[0, 3], [0, 4], [0, 5], [0, 6], [1, 2], [1, 3], [1, 6], [1, 7], [2, 2], [2, 7], [3, 2], [3, 3], [3, 6], [3, 7], [4, 3], [4, 4], [4, 5]]

const COLOR: Record<string, string> = {
  f: "var(--foreground)",
  p: "var(--primary)",
  k: "var(--background)",
}

export function Mascot({ size = 24, title = "Fathom", className }: { size?: number; title?: string; className?: string }) {
  const rects: React.ReactNode[] = []
  ROWS.forEach((row, r) => {
    for (let c = 0; c < row.length; c++) {
      const ch = row[c]
      if (ch === ".") continue
      rects.push(<rect key={`${r}-${c}`} x={c} y={r} width={1} height={1} fill={COLOR[ch]} />)
    }
  })
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} shapeRendering="crispEdges" role="img" aria-label={title} className={className}>
      <title>{title}</title>
      <g
        className="mascot-lure"
        style={{ animationName: "mascot-lure", animationDuration: "2.2s", animationTimingFunction: "ease-in-out", animationIterationCount: "infinite" }}
      >
        {HALO.map(([r, c]) => (
          <rect key={`h-${r}-${c}`} x={c} y={r} width={1} height={1} fill="var(--primary)" fillOpacity={0.3} />
        ))}
      </g>
      {rects}
    </svg>
  )
}
