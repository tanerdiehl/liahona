import { useSyncExternalStore } from 'react'
import { supabase } from './supabase'
import { getSettings, invalidateSettings } from './settings'
import { track } from './saveStatus'

// Your daily protein target range (grams), stored in your settings so it
// syncs across devices. Shared by Protein, Dashboard, Analytics and Review.
export const DEFAULT_TARGET = { min: 119, max: 167 }

let target = DEFAULT_TARGET
let loaded = false
const subs = new Set()
const emit = () => subs.forEach((fn) => fn())

function ensureLoaded() {
  if (loaded) return
  loaded = true
  getSettings()
    .then((s) => {
      if (s.protein_min && s.protein_max) {
        target = { min: s.protein_min, max: s.protein_max }
        emit()
      }
    })
    .catch(() => {
      loaded = false
    })
}

export function useProteinTarget() {
  ensureLoaded()
  return useSyncExternalStore(
    (fn) => {
      subs.add(fn)
      return () => subs.delete(fn)
    },
    () => target,
  )
}

export async function saveProteinTarget(min, max) {
  const settings = await getSettings()
  const { error } = await track(
    supabase.from('user_settings').update({ protein_min: min, protein_max: max }).eq('user_id', settings.user_id),
  )
  if (error) throw new Error(error.message)
  invalidateSettings()
  target = { min, max }
  emit()
}
