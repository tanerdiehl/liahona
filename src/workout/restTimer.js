import { useSyncExternalStore } from 'react'

// Rest timer shared across the app. Stored as an end time (not a ticking
// counter) in localStorage, so it stays correct if the phone locks or the
// app is closed and reopened mid-rest.
const KEY = 'liahona.rest'
export const DEFAULT_REST = 90
export const REST_CHOICES = [0, 30, 45, 60, 90, 120, 150, 180, 240, 300]

function read() {
  try {
    return JSON.parse(localStorage.getItem(KEY))
  } catch {
    return null
  }
}

let state = read() // { endsAt, total, label } | null
const subs = new Set()
function set(next) {
  state = next
  try {
    if (next) localStorage.setItem(KEY, JSON.stringify(next))
    else localStorage.removeItem(KEY)
  } catch {
    /* timer still works for this session */
  }
  subs.forEach((fn) => fn())
}

export function useRest() {
  return useSyncExternalStore(
    (fn) => {
      subs.add(fn)
      return () => subs.delete(fn)
    },
    () => state,
  )
}

export function startRest(seconds, label) {
  if (!seconds) return set(null)
  unlockAudio()
  set({ endsAt: Date.now() + seconds * 1000, total: seconds, label })
}

export function adjustRest(delta) {
  if (!state) return
  const endsAt = Math.max(Date.now(), state.endsAt + delta * 1000)
  set({ ...state, endsAt, total: Math.max(1, state.total + delta) })
}

export const skipRest = () => set(null)

export function formatRest(s) {
  if (!s) return 'Off'
  const m = Math.floor(s / 60)
  const sec = s % 60
  return m ? `${m}:${String(sec).padStart(2, '0')}` : `${sec}s`
}

// ---------- end-of-rest alert ----------
// iPhone only plays sound after a tap has "unlocked" audio, so this runs on
// the set check-off tap that starts the timer.
let ctx = null
function unlockAudio() {
  try {
    ctx ??= new (window.AudioContext || window.webkitAudioContext)()
    if (ctx.state === 'suspended') ctx.resume()
  } catch {
    ctx = null
  }
}

export function restDoneAlert() {
  navigator.vibrate?.([200, 100, 200])
  if (!ctx) return
  try {
    // Two soft beeps.
    for (const offset of [0, 0.25]) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.frequency.value = 880
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + offset)
      gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + offset + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + offset + 0.18)
      osc.connect(gain).connect(ctx.destination)
      osc.start(ctx.currentTime + offset)
      osc.stop(ctx.currentTime + offset + 0.2)
    }
  } catch {
    /* sound is a nice-to-have */
  }
}
