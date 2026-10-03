import { useEffect, useState } from 'react'
import { supabase } from './supabase'

// Your settings row (weight unit, tracking start, …), fetched once and shared.
let cache = null

export function getSettings() {
  cache ??= (async () => {
    const { data, error } = await supabase.from('user_settings').select('*').maybeSingle()
    if (error) throw error
    if (data) return data
    const { data: created, error: e2 } = await supabase.from('user_settings').insert({}).select().single()
    if (e2) throw e2
    return created
  })().catch((e) => {
    cache = null
    throw e
  })
  return cache
}

export function invalidateSettings() {
  cache = null
}

// The day you started using Liahona. Views and stats ignore anything earlier
// (it's hidden, not deleted). undefined while loading, null if unset.
export function useTrackingStart() {
  const [start, setStart] = useState(undefined)
  useEffect(() => {
    getSettings()
      .then((s) => setStart(s.tracking_start ?? null))
      .catch(() => setStart(null))
  }, [])
  return start
}

export const maxDate = (a, b) => (!a ? b : !b ? a : a > b ? a : b)
