import { useLayoutEffect, useRef, useState } from 'react'
import { addDays, dateRange, formatShort, fromISO, startOfWeek, todayISO, weekRange } from '../lib/dates'

const monthFmt = new Intl.DateTimeFormat(undefined, { month: 'short' })

// Small hover/tap tooltip shared by every chart. Positions are relative
// to the chart's wrapper element.
function useTip() {
  const wrap = useRef(null)
  const [tip, setTip] = useState(null)
  const show = (e, text) => {
    const box = wrap.current.getBoundingClientRect()
    const r = e.currentTarget.getBoundingClientRect()
    setTip({ text, x: r.left + r.width / 2 - box.left, y: r.top - box.top })
  }
  const handlers = (text) => ({
    onMouseEnter: (e) => show(e, text),
    onMouseLeave: () => setTip(null),
    onClick: (e) => show(e, text),
  })
  const node = tip && (
    <div className="chart-tip" style={{ left: tip.x, top: tip.y }}>
      {tip.text}
    </div>
  )
  return { wrap, handlers, node, hide: () => setTip(null) }
}

const STATUS_WORD = { done: 'Done', missed: 'Missed' }

// GitHub-style calendar: one column per week, one row per weekday.
// Weekly habits get a single row of week cells instead.
export function Heatmap({ habit, logs, start, weeks = 52 }) {
  const today = todayISO()
  const thisWeek = startOfWeek(today)
  const cols = weekRange(addDays(thisWeek, -7 * (weeks - 1)), thisWeek)
  const weekly = habit.frequency === 'weekly'
  const CELL = 12
  const GAP = 3
  const STEP = CELL + GAP
  const LEFT = weekly ? 0 : 26
  const TOP = 16
  const rows = weekly ? 1 : 7
  const width = LEFT + cols.length * STEP
  const height = TOP + rows * STEP

  const scroller = useRef(null)
  const { wrap, handlers, node, hide } = useTip()
  useLayoutEffect(() => {
    if (scroller.current) scroller.current.scrollLeft = scroller.current.scrollWidth
  }, [])

  function fillFor(unit) {
    const s = logs.get(unit)
    if (s === 'done') return habit.color
    if (s === 'missed') return 'var(--danger-soft)'
    const inRange = unit >= start && unit <= (weekly ? thisWeek : today)
    return inRange ? 'var(--surface-2)' : 'transparent'
  }

  const cells = []
  const monthLabels = []
  cols.forEach((w, ci) => {
    const x = LEFT + ci * STEP
    const month = w.slice(0, 7)
    if (ci === 0 || month !== cols[ci - 1].slice(0, 7))
      monthLabels.push(
        <text key={w} x={x} y={10} className="chart-label">
          {monthFmt.format(fromISO(w))}
        </text>,
      )
    const units = weekly ? [w] : dateRange(w, addDays(w, 6))
    units.forEach((u, ri) => {
      if (!weekly && u > today) return
      const status = logs.get(u)
      const label = `${weekly ? 'Week of ' : ''}${formatShort(u)} · ${STATUS_WORD[status] ?? 'Blank'}`
      cells.push(
        <rect
          key={u}
          x={x}
          y={TOP + ri * STEP}
          width={CELL}
          height={CELL}
          rx={3}
          style={{ fill: fillFor(u), stroke: 'var(--border)', strokeWidth: fillFor(u) === 'transparent' ? 1 : 0 }}
          {...handlers(label)}
        />,
      )
    })
  })

  return (
    <div className="chart-wrap" ref={wrap} onMouseLeave={hide}>
      <div className="heatmap-scroll" ref={scroller} onScroll={hide}>
        <svg width={width} height={height} role="img" aria-label={`${habit.name} calendar`}>
          {monthLabels}
          {!weekly &&
            ['Mon', 'Wed', 'Fri'].map((d, i) => (
              <text key={d} x={0} y={TOP + (1 + i * 2) * STEP + CELL - 2} className="chart-label">
                {d}
              </text>
            ))}
          {cells}
        </svg>
      </div>
      {node}
    </div>
  )
}

// Weekly completion rate, one bar per week.
export function TrendBars({ trend, color }) {
  const W = 320
  const H = 96
  const TOP = 8
  const BOTTOM = 18
  const plotH = H - TOP - BOTTOM
  const plotW = W - 34
  const step = plotW / trend.length
  const barW = Math.min(18, step - 4)
  const { wrap, handlers, node, hide } = useTip()
  const y = (p) => TOP + plotH * (1 - p)

  return (
    <div className="chart-wrap" ref={wrap} onMouseLeave={hide}>
      <svg viewBox={`0 0 ${W} ${H}`} className="trend-svg" role="img" aria-label="Weekly completion rate, last 12 weeks">
        {[0.5, 1].map((p) => (
          <line key={p} x1={0} x2={plotW} y1={y(p)} y2={y(p)} className="grid-line" />
        ))}
        <text x={W} y={y(1) + 4} className="chart-label" textAnchor="end">
          100%
        </text>
        <text x={W} y={y(0.5) + 4} className="chart-label" textAnchor="end">
          50%
        </text>
        <line x1={0} x2={plotW} y1={y(0)} y2={y(0)} className="axis-line" />
        {trend.map((t, i) => {
          const cx = i * step + step / 2
          const label =
            t.pct == null
              ? `Week of ${formatShort(t.week)} · not tracked`
              : `Week of ${formatShort(t.week)} · ${t.done}/${t.total} (${Math.round(t.pct * 100)}%)`
          const h = t.pct ? Math.max(2, plotH * t.pct) : 0
          return (
            <g key={t.week} {...handlers(label)}>
              <rect x={i * step} y={TOP} width={step} height={plotH} fill="transparent" />
              {h > 0 && <path d={topRoundedBar(cx - barW / 2, y(0) - h, barW, h, 4)} style={{ fill: color }} />}
            </g>
          )
        })}
        <text x={0} y={H - 4} className="chart-label">
          {formatShort(trend[0].week)}
        </text>
        <text x={plotW} y={H - 4} className="chart-label" textAnchor="end">
          This week
        </text>
      </svg>
      {node}
    </div>
  )
}

// Daily protein totals with the target band shaded.
export function ProteinChart({ totals, days = 60, min, max }) {
  const today = todayISO()
  const series = dateRange(addDays(today, -(days - 1)), today).map((d) => ({ date: d, total: totals.get(d) ?? 0 }))
  const W = 640
  const H = 180
  const TOP = 10
  const BOTTOM = 20
  const RIGHT = 34
  const plotW = W - RIGHT
  const plotH = H - TOP - BOTTOM
  const yMax = Math.max(200, ...series.map((s) => s.total))
  const y = (g) => TOP + plotH * (1 - g / yMax)
  const step = plotW / series.length
  const barW = Math.max(2, step - 2)
  const { wrap, handlers, node, hide } = useTip()

  return (
    <div className="chart-wrap" ref={wrap} onMouseLeave={hide}>
      <svg viewBox={`0 0 ${W} ${H}`} className="protein-svg" role="img" aria-label={`Daily protein, last ${days} days`}>
        <rect x={0} y={y(max)} width={plotW} height={y(min) - y(max)} className="target-band" />
        {[min, max].map((g) => (
          <text key={g} x={W} y={y(g) + 4} className="chart-label" textAnchor="end">
            {g}g
          </text>
        ))}
        <line x1={0} x2={plotW} y1={y(0)} y2={y(0)} className="axis-line" />
        {series.map((s, i) => {
          const h = s.total ? plotH * (s.total / yMax) : 0
          const label = `${formatShort(s.date)} · ${s.total ? `${Math.round(s.total)} g` : 'nothing logged'}`
          return (
            <g key={s.date} {...handlers(label)}>
              <rect x={i * step} y={TOP} width={step} height={plotH} fill="transparent" />
              {h > 0 && (
                <path
                  d={topRoundedBar(i * step + (step - barW) / 2, y(0) - h, barW, h, Math.min(3, barW / 2))}
                  className={s.total >= min ? 'bar-hit' : 'bar-miss'}
                />
              )}
            </g>
          )
        })}
        <text x={0} y={H - 4} className="chart-label">
          {formatShort(series[0].date)}
        </text>
        <text x={plotW} y={H - 4} className="chart-label" textAnchor="end">
          Today
        </text>
      </svg>
      {node}
    </div>
  )
}

// Bar path with rounded top corners and a square base on the baseline.
function topRoundedBar(x, y, w, h, r) {
  r = Math.min(r, w / 2, h)
  return `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`
}
