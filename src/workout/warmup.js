// Warm-up set suggestions that ramp up to a working weight, rounded to
// weights you can actually load.

const BAR = { lbs: 45, kg: 20 }
const STEP = { lbs: 5, kg: 2.5 }

// Barbell: empty bar, then ~50/70/85% of working weight.
// Everything else: ~50/70/85% with a few more reps on the lighter sets.
const RAMP = [
  [0.5, 5],
  [0.7, 3],
  [0.85, 1],
]

export function warmupSets(working, unit, equipment) {
  const w = Number(working)
  if (!(w > 0)) return []
  const step = equipment === 'Dumbbell' && unit === 'kg' ? 2 : STEP[unit]
  const round = (x) => Math.round(x / step) * step
  const barbell = equipment === 'Barbell' || equipment === 'EZ Bar'
  const bar = equipment === 'EZ Bar' ? (unit === 'kg' ? 10 : 25) : BAR[unit]

  const out = []
  if (barbell && w > bar) out.push({ weight: bar, reps: 10 })
  for (const [pct, reps] of RAMP) {
    const weight = round(w * pct)
    const floor = barbell ? bar : step
    if (weight <= floor || weight >= w) continue
    // Skip jumps too small to matter (e.g. 45 then 50).
    if (out.length && weight - out[out.length - 1].weight < step * 2) continue
    out.push({ weight, reps: barbell ? reps : reps + 3 })
  }
  // Light working weights don't need much: keep it to the two heaviest.
  return w <= (barbell ? bar * 2 : step * 6) ? out.slice(-2) : out
}
