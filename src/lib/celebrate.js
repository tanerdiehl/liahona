import { useSyncExternalStore } from 'react'
import confetti from 'canvas-confetti'
import { ALL_HABITS_DONE, HABIT_DONE, pick } from './quips'

// ---------- toasts ----------
let toasts = []
const subs = new Set()
const emit = () => subs.forEach((fn) => fn())
let nextId = 1

export function toast({ title, body, color, duration = 3200 }) {
  const id = nextId++
  toasts = [...toasts.slice(-2), { id, title, body, color }]
  emit()
  setTimeout(() => dismissToast(id), duration)
}

export function dismissToast(id) {
  toasts = toasts.filter((t) => t.id !== id)
  emit()
}

export function useToasts() {
  return useSyncExternalStore(
    (fn) => {
      subs.add(fn)
      return () => subs.delete(fn)
    },
    () => toasts,
  )
}

// ---------- confetti ----------
const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

function originOf(el) {
  if (!el) return { x: 0.5, y: 0.6 }
  const r = el.getBoundingClientRect()
  return { x: (r.left + r.width / 2) / window.innerWidth, y: (r.top + r.height / 2) / window.innerHeight }
}

// A small pop from the element that was tapped.
export function burst(el, color) {
  if (reducedMotion()) return
  confetti({
    particleCount: 28,
    spread: 60,
    startVelocity: 22,
    ticks: 90,
    scalar: 0.8,
    origin: originOf(el),
    colors: color ? [color, '#ffffff', '#1D9E75'] : undefined,
    disableForReducedMotion: true,
  })
}

// The big one — every habit done for the day.
export function bigCelebration(colors) {
  if (reducedMotion()) return
  const end = Date.now() + 900
  ;(function frame() {
    confetti({ particleCount: 5, angle: 60, spread: 60, origin: { x: 0, y: 0.7 }, colors })
    confetti({ particleCount: 5, angle: 120, spread: 60, origin: { x: 1, y: 0.7 }, colors })
    if (Date.now() < end) requestAnimationFrame(frame)
  })()
}

// ---------- habits ----------

// Called when a habit cell turns ✓. Reminds you *why* you do it.
// allDone: every daily habit is now ✓ for that day.
export function celebrateHabit(habit, el, { allDone = false, colors } = {}) {
  if (allDone) {
    bigCelebration(colors)
    toast({ title: pick(ALL_HABITS_DONE), color: habit.color, duration: 4500 })
    return
  }
  burst(el, habit.color)
  toast({
    title: `${habit.name} ✓`,
    body: habit.why?.trim() ? `Why: ${habit.why.trim()}` : pick(HABIT_DONE),
    color: habit.color,
  })
}
