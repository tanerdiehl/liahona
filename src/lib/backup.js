import { supabase } from './supabase'
import { fetchAll } from './habits'
import { todayISO } from './dates'

const TABLES = ['habits', 'habit_logs', 'protein_entries', 'tasks', 'goals', 'goal_items', 'journal_entries']

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
  a.click()
  URL.revokeObjectURL(url)
}
