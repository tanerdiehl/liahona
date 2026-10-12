// Front/back body diagram shaded by working sets per muscle group.
// sets: { Chest: 12, Back: 9, ... } — darker = more sets (relative to the
// most-trained group). Groups that don't map to one spot (Full body,
// Cardio, Other) are listed underneath.

const COLOR = '#1D9E75'
const NEUTRAL = 'var(--surface-2)'

// [group, svg shape props] for each view. Coordinates in a 200×380 box.
const FRONT = [
  ['Shoulders', { ellipse: [62, 90, 16, 13] }],
  ['Shoulders', { ellipse: [138, 90, 16, 13] }],
  ['Chest', { rect: [70, 80, 29, 34, 9] }],
  ['Chest', { rect: [101, 80, 29, 34, 9] }],
  ['Biceps', { ellipse: [51, 124, 9, 21] }],
  ['Biceps', { ellipse: [149, 124, 9, 21] }],
  ['Forearms', { ellipse: [44, 172, 8, 22] }],
  ['Forearms', { ellipse: [156, 172, 8, 22] }],
  ['Core', { rect: [77, 118, 46, 68, 10] }],
  ['Quads', { ellipse: [86, 248, 14, 40] }],
  ['Quads', { ellipse: [114, 248, 14, 40] }],
  ['Calves', { ellipse: [86, 326, 10, 28] }],
  ['Calves', { ellipse: [114, 326, 10, 28] }],
]
const BACK = [
  ['Back', { rect: [78, 70, 44, 18, 8] }], // traps
  ['Shoulders', { ellipse: [62, 90, 16, 13] }],
  ['Shoulders', { ellipse: [138, 90, 16, 13] }],
  ['Back', { rect: [72, 92, 56, 56, 14] }], // lats / upper back
  ['Back', { rect: [81, 151, 38, 32, 9] }], // lower back
  ['Triceps', { ellipse: [51, 124, 9, 21] }],
  ['Triceps', { ellipse: [149, 124, 9, 21] }],
  ['Forearms', { ellipse: [44, 172, 8, 22] }],
  ['Forearms', { ellipse: [156, 172, 8, 22] }],
  ['Glutes', { ellipse: [88, 204, 14, 15] }],
  ['Glutes', { ellipse: [112, 204, 14, 15] }],
  ['Hamstrings', { ellipse: [86, 256, 13, 34] }],
  ['Hamstrings', { ellipse: [114, 256, 13, 34] }],
  ['Calves', { ellipse: [86, 326, 11, 28] }],
  ['Calves', { ellipse: [114, 326, 11, 28] }],
]
const MAPPED = new Set([...FRONT, ...BACK].map(([g]) => g))

// Neutral body outline pieces shared by both views.
function Skeleton() {
  return (
    <g style={{ fill: NEUTRAL, opacity: 0.6 }}>
      <circle cx={100} cy={36} r={20} />
      <rect x={92} y={55} width={16} height={14} rx={4} />
      <rect x={76} y={186} width={48} height={22} rx={8} />
      <circle cx={42} cy={200} r={7} />
      <circle cx={158} cy={200} r={7} />
      <ellipse cx={86} cy={292} rx={8} ry={6} />
      <ellipse cx={114} cy={292} rx={8} ry={6} />
      <ellipse cx={84} cy={360} rx={11} ry={6} />
      <ellipse cx={116} cy={360} rx={11} ry={6} />
    </g>
  )
}

function Region({ shape, fill, label }) {
  const common = { style: { fill, stroke: 'var(--surface)', strokeWidth: 2 } }
  const el = shape.ellipse ? (
    <ellipse cx={shape.ellipse[0]} cy={shape.ellipse[1]} rx={shape.ellipse[2]} ry={shape.ellipse[3]} {...common} />
  ) : (
    <rect
      x={shape.rect[0]}
      y={shape.rect[1]}
      width={shape.rect[2]}
      height={shape.rect[3]}
      rx={shape.rect[4]}
      {...common}
    />
  )
  return (
    <g>
      <title>{label}</title>
      {el}
    </g>
  )
}

export default function MuscleMap({ sets, compact = false }) {
  const max = Math.max(0, ...Object.entries(sets).filter(([g]) => MAPPED.has(g)).map(([, n]) => n))
  const fillFor = (g) => {
    const n = sets[g] ?? 0
    if (!n || !max) return NEUTRAL
    const pct = Math.round(25 + (n / max) * 75)
    return `color-mix(in srgb, ${COLOR} ${pct}%, var(--surface-2))`
  }
  const label = (g) => `${g}: ${sets[g] ?? 0} working set${sets[g] === 1 ? '' : 's'}`
  const unmapped = Object.entries(sets).filter(([g, n]) => !MAPPED.has(g) && n > 0)

  const view = (regions, dx, title) => (
    <g transform={`translate(${dx},0)`}>
      <Skeleton />
      {regions.map(([g, shape], i) => (
        <Region key={i} shape={shape} fill={fillFor(g)} label={label(g)} />
      ))}
      <text x={100} y={378} textAnchor="middle" className="chart-label">
        {title}
      </text>
    </g>
  )

  return (
    <div className={`muscle-map ${compact ? 'compact' : ''}`}>
      <svg viewBox="0 0 420 384" role="img" aria-label="Muscles worked, front and back">
        {view(FRONT, 0, 'Front')}
        {view(BACK, 220, 'Back')}
      </svg>
      <div className="muscle-legend">
        <span className="muted small">Fewer sets</span>
        <span className="legend-ramp" />
        <span className="muted small">More</span>
      </div>
      {unmapped.length > 0 && (
        <p className="muted small">
          Also: {unmapped.map(([g, n]) => `${g} ${n} set${n === 1 ? '' : 's'}`).join(' · ')}
        </p>
      )}
    </div>
  )
}
