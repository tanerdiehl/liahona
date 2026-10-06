import { useEffect, useRef } from 'react'
import { adjustRest, restDoneAlert, skipRest, useRest } from './restTimer'
import { useNow } from './useNow'
import { toast } from '../lib/celebrate'

// Countdown pinned above the tab bar while you rest.
export default function RestTimerBar() {
  const rest = useRest()
  const now = useNow(250)
  const alerted = useRef(null)

  const remaining = rest ? Math.max(0, Math.ceil((rest.endsAt - now) / 1000)) : 0

  useEffect(() => {
    if (!rest || remaining > 0 || alerted.current === rest.endsAt) return
    alerted.current = rest.endsAt
    // Only alert if the rest ended in the last few seconds (not on reopening
    // the app long after).
    if (now - rest.endsAt < 5000) {
      restDoneAlert()
      toast({ title: 'Rest’s up', body: rest.label ? `Next set: ${rest.label}` : 'Time for your next set.' })
    }
    skipRest()
  }, [rest, remaining, now])

  // Leave room at the bottom of the page so the bar never covers buttons.
  const showing = Boolean(rest) && remaining > 0
  useEffect(() => {
    document.body.classList.toggle('resting', showing)
    return () => document.body.classList.remove('resting')
  }, [showing])

  if (!showing) return null
  const pct = Math.min(100, (remaining / rest.total) * 100)
  const m = Math.floor(remaining / 60)
  const s = String(remaining % 60).padStart(2, '0')

  return (
    <div className="rest-bar" role="timer" aria-live="off">
      <div className="rest-progress" style={{ width: `${pct}%` }} />
      <div className="rest-content">
        <button className="rest-btn" onClick={() => adjustRest(-15)} aria-label="15 seconds less">
          −15
        </button>
        <div className="rest-time">
          <span className="rest-label">Rest{rest.label ? ` · ${rest.label}` : ''}</span>
          <strong>
            {m}:{s}
          </strong>
        </div>
        <button className="rest-btn" onClick={() => adjustRest(15)} aria-label="15 seconds more">
          +15
        </button>
        <button className="rest-btn skip" onClick={skipRest}>
          Skip
        </button>
      </div>
    </div>
  )
}
