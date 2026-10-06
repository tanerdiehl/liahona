import { useSyncExternalStore } from 'react'
import { supabase } from './supabase'

// Offline-safe save queue. Changes are written to this device first
// (localStorage), then sent to Supabase in order. With no signal they wait —
// even if the app is closed — and send themselves when you're back online.
//
// An op is plain data so it can be stored:
//   { table, action: 'insert' | 'update' | 'delete', values?, match: { col: value | [values] } }
// Inserts use ids made on the device, so re-sending one is harmless.

const KEY = 'liahona.outbox'
let queue = load()
let state = { pending: queue.length, syncing: false, error: '', offline: false }
const subs = new Set()
let running = null
let seq = Date.now()

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) ?? []
  } catch {
    return []
  }
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(queue))
  } catch {
    /* storage full/unavailable — ops still live in memory this session */
  }
  setState({ pending: queue.length })
}

function setState(patch) {
  state = { ...state, ...patch }
  subs.forEach((fn) => fn())
}

export function useOutbox() {
  return useSyncExternalStore(
    (fn) => {
      subs.add(fn)
      return () => subs.delete(fn)
    },
    () => state,
  )
}

export const hasPendingFor = (workoutId) => queue.some((op) => op.workoutId === workoutId)

// Add a change; returns right away. Updates to a row that's already waiting
// are merged into one, so a set edited ten times offline is one save.
export function enqueue(op) {
  const id = op.match?.id
  if (op.action === 'update' && typeof id === 'string') {
    let waiting = null
    for (let i = queue.length - 1; i >= 0 && !waiting; i--) {
      const q = queue[i]
      if (q.table === op.table && q.action === 'update' && q.match?.id === id && !q.inFlight) waiting = q
    }
    if (waiting) {
      waiting.values = { ...waiting.values, ...op.values }
      persist()
      drain()
      return
    }
  }
  queue.push({ ...op, key: ++seq })
  persist()
  drain()
}

const isNetworkError = (error) =>
  !navigator.onLine || /fetch|network|load failed|timed? ?out|offline/i.test(`${error?.message} ${error?.details}`)

function build(op) {
  let q = supabase.from(op.table)
  if (op.action === 'insert') q = q.insert(op.values)
  else if (op.action === 'update') q = q.update(op.values)
  else q = q.delete()
  if (op.action !== 'insert')
    for (const [col, val] of Object.entries(op.match ?? {})) q = Array.isArray(val) ? q.in(col, val) : q.eq(col, val)
  return q
}

// Sends everything waiting, oldest first. Returns how many are still waiting.
export function drain() {
  running ??= (async () => {
    setState({ syncing: true })
    while (queue.length) {
      const op = queue[0]
      op.inFlight = true
      let error
      try {
        ;({ error } = await build(op))
      } catch (e) {
        error = e
      }
      op.inFlight = false
      if (error && isNetworkError(error)) {
        setState({ offline: true })
        break // keep it; try again later
      }
      // 23505 = already saved (an earlier attempt got through) — that's fine.
      if (error && error.code !== '23505') setState({ error: `A change couldn't be saved — ${error.message}` })
      else setState({ error: '' })
      queue.shift()
      persist()
      setState({ offline: false })
    }
    setState({ syncing: false })
    running = null
    return queue.length
  })()
  return running
}

// Retry when the connection comes back, the app reopens, or every 15s.
export function startOutbox() {
  window.addEventListener('online', () => drain())
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && drain())
  setInterval(() => queue.length && drain(), 15000)
  if (queue.length) drain()
}

export const clearOutboxError = () => setState({ error: '' })
