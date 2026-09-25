import { useSyncExternalStore } from 'react'

// Tracks every write to Supabase so the app can show "Saving… / Saved /
// Not saved" and warn before you close the tab mid-save.

let state = { pending: 0, error: null }
const subs = new Set()
const emit = () => subs.forEach((fn) => fn())
const set = (patch) => {
  state = { ...state, ...patch }
  emit()
}

// Wrap any Supabase write: track(supabase.from('x').insert(...))
// Resolves to the same { data, error } result.
export function track(query) {
  set({ pending: state.pending + 1 })
  return Promise.resolve(query)
    .then((res) => {
      set({ error: res?.error ? res.error.message : null })
      return res
    })
    .catch((e) => {
      set({ error: e.message ?? String(e) })
      return { data: null, error: e }
    })
    .finally(() => set({ pending: state.pending - 1 }))
}

export function useSaveStatus() {
  return useSyncExternalStore(
    (fn) => {
      subs.add(fn)
      return () => subs.delete(fn)
    },
    () => state,
  )
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', (e) => {
    if (state.pending > 0) {
      e.preventDefault()
      e.returnValue = ''
    }
  })
}
