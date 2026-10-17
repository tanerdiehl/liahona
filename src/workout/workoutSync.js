import { useSyncExternalStore } from 'react'
import { supabase } from '../lib/supabase'
import { clearWorkoutCache, readWorkoutCache, writeWorkoutCache } from './workoutCache'

// Saving workouts. The phone's copy of a workout is the truth while you're
// logging: every change is written to this device straight away, and the
// whole workout (not a list of separate changes) is uploaded in the
// background. If an upload fails for any reason — no signal, signed-out
// session, a server hiccup — nothing is thrown away; it just tries again
// until the server matches the phone.
//
// Local copy (see workoutCache.js): { workout, entries: [{ we, sets, previous }], exercises, targets, unit, savedAt }

const DIRTY = 'liahona.dirtyWorkouts' // ids waiting to upload
const DELETED = 'liahona.deletedWorkouts' // ids waiting to be deleted on the server

const readList = (k) => {
  try {
    return JSON.parse(localStorage.getItem(k)) ?? []
  } catch {
    return []
  }
}
const writeList = (k, list) => {
  try {
    localStorage.setItem(k, JSON.stringify([...new Set(list)]))
  } catch {
    /* ignore */
  }
}

let state = { pending: readList(DIRTY).length + readList(DELETED).length, syncing: false, error: '' }
const subs = new Set()
function setState(patch) {
  state = { ...state, ...patch, pending: readList(DIRTY).length + readList(DELETED).length }
  subs.forEach((fn) => fn())
}
export function useWorkoutSync() {
  return useSyncExternalStore(
    (fn) => {
      subs.add(fn)
      return () => subs.delete(fn)
    },
    () => state,
  )
}

export const isDirty = (id) => readList(DIRTY).includes(id)

// Save the workout on this phone and upload it soon.
let timer = null
export function saveWorkoutLocal(id, snapshot, { now = false } = {}) {
  writeWorkoutCache(id, snapshot)
  if (!isDirty(id)) writeList(DIRTY, [...readList(DIRTY), id])
  setState({})
  clearTimeout(timer)
  if (now) return syncAll()
  timer = setTimeout(syncAll, 1500)
}

// Keep a copy for opening with no signal, without uploading anything.
export const cacheWorkout = (id, snapshot) => writeWorkoutCache(id, snapshot)

export function discardWorkout(id) {
  clearWorkoutCache(id)
  writeList(DIRTY, readList(DIRTY).filter((x) => x !== id))
  writeList(DELETED, [...readList(DELETED), id])
  setState({})
  syncAll()
}

// Unfinished workouts saved on this phone (for "in progress" when offline).
export function localActiveWorkout() {
  for (const id of readList(DIRTY)) {
    const w = readWorkoutCache(id)?.workout
    if (w && !w.ended_at) return w
  }
  return null
}

// Workouts on this phone that haven't finished uploading.
export function pendingWorkouts() {
  return readList(DIRTY)
    .map((id) => readWorkoutCache(id))
    .filter((c) => c?.workout)
}

// Gives up waiting on a request after a while (gym wifi can hang forever).
function withTimeout(query, ms = 20000) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), ms)
  return query.abortSignal(ctrl.signal).then(
    (r) => {
      clearTimeout(t)
      return r
    },
    (e) => {
      clearTimeout(t)
      return { error: e }
    },
  )
}

async function run(query) {
  const { error } = await withTimeout(query)
  if (error) throw error
}

const WORKOUT_COLS = ['id', 'name', 'notes', 'workout_date', 'started_at', 'ended_at', 'routine_id']
const WE_COLS = ['id', 'workout_id', 'exercise_id', 'position', 'notes']
const SET_COLS = [
  'id',
  'workout_id',
  'workout_exercise_id',
  'exercise_id',
  'set_order',
  'set_type',
  'weight',
  'weight_unit',
  'reps',
  'duration_seconds',
  'distance',
  'distance_unit',
  'completed',
  'completed_at',
]
const pick = (row, cols) => Object.fromEntries(cols.filter((c) => c in row).map((c) => [c, row[c]]))
const notIn = (ids) => `(${ids.join(',')})`

// Make the server's copy of one workout match the phone's exactly.
async function upload(c) {
  const w = c.workout
  const wes = c.entries.map((e) => pick(e.we, WE_COLS))
  const sets = c.entries.flatMap((e) => e.sets.map((s) => ({ ...pick(s, SET_COLS), updated_at: new Date().toISOString() })))
  await run(supabase.from('workouts').upsert(pick(w, WORKOUT_COLS)))
  if (wes.length) await run(supabase.from('workout_exercises').upsert(wes))
  if (sets.length) await run(supabase.from('workout_sets').upsert(sets))
  // Remove anything deleted on the phone.
  let delSets = supabase.from('workout_sets').delete().eq('workout_id', w.id)
  if (sets.length) delSets = delSets.not('id', 'in', notIn(sets.map((s) => s.id)))
  await run(delSets)
  let delWes = supabase.from('workout_exercises').delete().eq('workout_id', w.id)
  if (wes.length) delWes = delWes.not('id', 'in', notIn(wes.map((x) => x.id)))
  await run(delWes)
}

let running = null
// Uploads everything waiting. Resolves true when nothing is left waiting.
export function syncAll() {
  running ??= (async () => {
    setState({ syncing: true })
    let lastError = ''
    try {
      // Make sure the sign-in is fresh (an expired one looks like a permission error).
      await supabase.auth.getSession()
      for (const id of readList(DELETED)) {
        try {
          await run(supabase.from('workouts').delete().eq('id', id))
          writeList(DELETED, readList(DELETED).filter((x) => x !== id))
        } catch (e) {
          lastError = e.message
        }
      }
      // A few passes, so changes made mid-upload (e.g. tapping Finish) go too.
      for (let pass = 0; pass < 3 && readList(DIRTY).length && !lastError; pass++) {
        for (const id of readList(DIRTY)) {
          const c = readWorkoutCache(id)
          if (!c?.workout) {
            writeList(DIRTY, readList(DIRTY).filter((x) => x !== id))
            continue
          }
          try {
            await upload(c)
            // Only mark it uploaded if nothing changed while it was uploading.
            if (readWorkoutCache(id)?.savedAt === c.savedAt) {
              writeList(DIRTY, readList(DIRTY).filter((x) => x !== id))
              if (c.workout.ended_at) clearWorkoutCache(id)
            }
          } catch (e) {
            lastError = e.message || 'upload failed'
            if (/jwt|token|auth|row-level security|permission/i.test(lastError))
              await supabase.auth.refreshSession().catch(() => {})
          }
        }
      }
    } finally {
      setState({ syncing: false, error: lastError })
      running = null
    }
    return readList(DIRTY).length + readList(DELETED).length === 0
  })()
  return running
}

// Upload within `ms`, or carry on and let it finish in the background.
export function syncSoon(ms = 4000) {
  return Promise.race([syncAll(), new Promise((r) => setTimeout(() => r(false), ms))])
}

// Older versions of the app kept a copy of the open workout on the phone.
// If any of those never reached the server, upload them now.
async function recoverOrphans() {
  const ids = []
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k?.startsWith('liahona.workout.')) ids.push(k.slice('liahona.workout.'.length))
    }
  } catch {
    return
  }
  const dirty = readList(DIRTY)
  const candidates = ids.filter((id) => !dirty.includes(id))
  if (!candidates.length) return
  const { data, error } = await supabase.from('workouts').select('id').in('id', candidates)
  if (error) return
  const onServer = new Set(data.map((w) => w.id))
  const missing = candidates.filter((id) => !onServer.has(id) && readWorkoutCache(id)?.entries?.length)
  if (missing.length) {
    writeList(DIRTY, [...readList(DIRTY), ...missing])
    setState({})
  }
}

export function startWorkoutSync() {
  window.addEventListener('online', () => syncAll())
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && syncAll())
  setInterval(() => state.pending && syncAll(), 20000)
  recoverOrphans()
    .catch(() => {})
    .then(() => state.pending && syncAll())
}
