import { supabase } from './supabase'
import { fetchAll } from './habits'
import { todayISO } from './dates'
import { getSettings, invalidateSettings } from './settings'

const TABLES = [
  'habits',
  'habit_logs',
  'protein_entries',
  'tasks',
  'goals',
  'goal_items',
  'journal_entries',
  'user_settings',
  'exercises',
  'workouts',
  'workout_exercises',
  'workout_sets',
  'routine_folders',
  'routines',
  'routine_exercises',
  'body_logs',
  'progress_photos',
]

// Downloads every row you own as one JSON file — a copy of your data that
// lives outside Supabase.
export async function downloadBackup() {
  const backup = { app: 'Liahona', exported_at: new Date().toISOString(), tables: {} }
  for (const table of TABLES) {
    try {
      backup.tables[table] = await fetchAll(() => supabase.from(table).select('*'))
    } catch (e) {
      backup.tables[table] = { error: e.message }
    }
  }
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `liahona-backup-${todayISO()}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)

  // Remember when, for the monthly backup reminder (synced across devices).
  try {
    const settings = await getSettings()
    await supabase.from('user_settings').update({ last_backup_at: new Date().toISOString() }).eq('user_id', settings.user_id)
    invalidateSettings()
  } catch {
    /* the backup itself still downloaded */
  }
}
