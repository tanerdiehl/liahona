import { useLayoutEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { addDays, fromISO, startOfWeek, todayISO, toISO } from '../lib/dates'

// Shared sizing: one column per time bucket; wide histories scroll sideways
// (starting at the most recent end).
function useWidth() {
  const ref = useRef(null)
  const [width, setWidth] = useState(320)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(240, Math.floor(e.contentRect.width))))
    ro.observe(el)
    el.scrollLeft = el.scrollWidth
    return () => ro.disconnect()
  }, [])
  return [ref, width]
}

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
    <div className="chart-tip" style={{ left: Math.max(60, tip.x), top: tip.y }}>
      {tip.text}
    </div>
  )
  return { wrap, handlers, node, hide: () => setTip(null) }
}

function niceMax(v) {
  if (v <= 0) return 1
  const p = 10 ** Math.floor(Math.log10(v))
  const n = v / p
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p
}

const H = 170
const TOP = 12
const BOTTOM = 22
const RIGHT = 44
const MIN_STEP = 30

function frame(n, width) {
  const plotW = Math.max(width - RIGHT, n * MIN_STEP)
  return { plotW, svgW: plotW + RIGHT, step: plotW / Math.max(1, n), plotH: H - TOP - BOTTOM }
}

function Axis({ plotW, max, plotH, format }) {
  const y = (v) => TOP + plotH * (1 - v / max)
  return (
    <>
      {[max / 2, max].map((v) => (
        <g key={v}>
          <line x1={0} x2={plotW} y1={y(v)} y2={y(v)} className="grid-line" />
          <text x={plotW + 4} y={y(v) + 4} className="chart-label">
            {format(v)}
          </text>
        </g>
      ))}
      <line x1={0} x2={plotW} y1={y(0)} y2={y(0)} className="axis-line" />
    </>
  )
}

function XLabels({ data, step }) {
  const every = Math.ceil(56 / step)
  return data.map((d, i) =>
    i % every === 0 || i === data.length - 1 ? (
      <text key={d.key} x={i * step + step / 2} y={H - 6} className="chart-label" textAnchor="middle">
        {d.label}
      </text>
    ) : null,
  )
}

// data: [{ key, label, value, tip }]
export function BarChart({ data, color, format = (v) => Math.round(v) }) {
  const [scroller, width] = useWidth()
  const { wrap, handlers, node, hide } = useTip()
  if (!data.length) return <p className="muted small">No data yet.</p>
  const { plotW, svgW, step, plotH } = frame(data.length, width)
  const max = niceMax(Math.max(...data.map((d) => d.value)))
  const barW = Math.min(22, step - 6)
  return (
    <div className="chart-wrap" ref={wrap} onMouseLeave={hide}>
      <div className="wchart-scroll" ref={scroller} onScroll={hide}>
        <svg width={svgW} height={H} role="img">
          <Axis plotW={plotW} max={max} plotH={plotH} format={format} />
          {data.map((d, i) => {
            const h = d.value > 0 ? Math.max(2, (d.value / max) * plotH) : 0
            const x = i * step + (step - barW) / 2
            return (
              <g key={d.key} {...handlers(d.tip)}>
                <rect x={i * step} y={TOP} width={step} height={plotH} fill="transparent" />
                {h > 0 && <path d={roundedTop(x, TOP + plotH - h, barW, h, Math.min(4, barW / 2))} style={{ fill: color }} />}
              </g>
            )
          })}
          <XLabels data={data} step={step} />
        </svg>
      </div>
      {node}
    </div>
  )
}

// data: [{ key, label, value|null, tip }] — points only where value > 0.
export function LineChart({ data, color, format = (v) => Math.round(v) }) {
  const [scroller, width] = useWidth()
  const { wrap, handlers, node, hide } = useTip()
  const pts = data.map((d, i) => ({ ...d, i })).filter((d) => d.value > 0)
  if (!pts.length) return <p className="muted small">No data yet.</p>
  const { plotW, svgW, step, plotH } = frame(data.length, width)
  const vals = pts.map((p) => p.value)
  const lo = Math.min(...vals)
  const hi = Math.max(...vals)
  // Zoom the y-axis to the data's range so progress is visible.
  const pad = Math.max(1, (hi - lo) * 0.15)
  const min = Math.max(0, Math.floor((lo - pad) / 5) * 5)
  const max = Math.ceil((hi + pad) / 5) * 5
  const y = (v) => TOP + plotH * (1 - (v - min) / (max - min))
  const x = (i) => i * step + step / 2
  return (
    <div className="chart-wrap" ref={wrap} onMouseLeave={hide}>
      <div className="wchart-scroll" ref={scroller} onScroll={hide}>
        <svg width={svgW} height={H} role="img">
          {[min, (min + max) / 2, max].map((v) => (
            <g key={v}>
              <line x1={0} x2={plotW} y1={y(v)} y2={y(v)} className="grid-line" />
              <text x={plotW + 4} y={y(v) + 4} className="chart-label">
                {format(v)}
              </text>
            </g>
          ))}
          <polyline
            points={pts.map((p) => `${x(p.i)},${y(p.value)}`).join(' ')}
            fill="none"
            style={{ stroke: color }}
            strokeWidth={2}
            strokeLinejoin="round"
          />
          {pts.map((p) => (
            <g key={p.key} {...handlers(p.tip)}>
              <circle cx={x(p.i)} cy={y(p.value)} r={12} fill="transparent" />
              <circle cx={x(p.i)} cy={y(p.value)} r={4} style={{ fill: color, stroke: 'var(--surface)' }} strokeWidth={2} />
            </g>
          ))}
          <XLabels data={data} step={step} />
        </svg>
      </div>
      {node}
    </div>
  )
}

function roundedTop(x, y, w, h, r) {
  r = Math.min(r, w / 2, h)
  return `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`
}

// Month grid with training days highlighted. Tap a day to open its workout.
const monthTitle = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' })
const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

export function TrainingCalendar({ sessions, color }) {
  const today = todayISO()
  const [month, setMonth] = useState(today.slice(0, 7))
  const byDate = new Map()
  for (const s of sessions) byDate.set(s.date, [...(byDate.get(s.date) ?? []), s])

  const first = `${month}-01`
  const firstD = fromISO(first)
  const daysInMonth = new Date(firstD.getFullYear(), firstD.getMonth() + 1, 0).getDate()
  const gridStart = startOfWeek(first)
  const weeks = Math.ceil((firstD.getDay() + daysInMonth) / 7)
  const cells = []
  for (let d = gridStart; cells.length < weeks * 7; d = addDays(d, 1)) cells.push(d)

  const shift = (n) => setMonth(toISO(new Date(firstD.getFullYear(), firstD.getMonth() + n, 1)).slice(0, 7))
  const trainedThisMonth = [...byDate.keys()].filter((d) => d.startsWith(month)).length

  return (
    <div className="tcal">
      <div className="tcal-head">
        <button className="btn ghost small" onClick={() => shift(-1)} aria-label="Previous month">
          ‹
        </button>
        <strong>{monthTitle.format(firstD)}</strong>
        <button
          className="btn ghost small"
          onClick={() => shift(1)}
          disabled={month >= today.slice(0, 7)}
          aria-label="Next month"
        >
          ›
        </button>
      </div>
      <div className="tcal-grid">
        {DOW.map((d, i) => (
          <span key={i} className="tcal-dow">
            {d}
          </span>
        ))}
        {cells.map((d) => {
          const inMonth = d.startsWith(month)
          const list = byDate.get(d)
          const label = fromISO(d).getDate()
          if (list && inMonth)
            return (
              <Link
                key={d}
                to={`/workout/${list[0].id}`}
                className="tcal-day trained"
                style={{ background: color }}
                title={list.map((s) => s.name || 'Workout').join(', ')}
              >
                {label}
              </Link>
            )
          return (
            <span key={d} className={`tcal-day ${inMonth ? '' : 'out'} ${d === today ? 'today' : ''}`}>
              {inMonth ? label : ''}
            </span>
          )
        })}
      </div>
      <p className="muted small">
        {trainedThisMonth} training day{trainedThisMonth === 1 ? '' : 's'} this month
      </p>
    </div>
  )
}
