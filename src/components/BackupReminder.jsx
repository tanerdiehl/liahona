import { useEffect, useState } from 'react'
import { getSettings } from '../lib/settings'
import { downloadBackup } from '../lib/backup'

const SNOOZE_KEY = 'liahona.backup.snoozeUntil'
const EVERY_DAYS = 30

// Nudges you to download a full backup if it's been a month (or never).
export default function BackupReminder() {
  const [last, setLast] = useState(undefined) // undefined = loading, null = never
  const [busy, setBusy] = useState(false)
  const [hidden, setHidden] = useState(() => {
    try {
      return Number(localStorage.getItem(SNOOZE_KEY) || 0) > Date.now()
    } catch {
      return false
    }
  })

  useEffect(() => {
    getSettings()
      .then((s) => setLast(s.last_backup_at ?? null))
      .catch(() => setLast(undefined))
  }, [])

  if (hidden || last === undefined) return null
  const days = last ? Math.floor((Date.now() - new Date(last)) / 864e5) : null
  if (days != null && days < EVERY_DAYS) return null

  function snooze() {
    try {
      localStorage.setItem(SNOOZE_KEY, String(Date.now() + 7 * 864e5))
    } catch {
      /* fine */
    }
    setHidden(true)
  }

  return (
    <div className="card backup-reminder">
      <span className="grow">
        <strong>📦 {days == null ? 'You haven’t downloaded a backup yet' : `Last backup: ${days} days ago`}</strong>
        <span className="muted small">A copy of everything, saved to your device. Takes a few seconds.</span>
      </span>
      <div className="backup-actions">
        <button className="btn ghost small" onClick={snooze}>
          Later
        </button>
        <button
          className="btn primary small"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            await downloadBackup()
            setBusy(false)
            setHidden(true)
          }}
        >
          {busy ? 'Preparing…' : 'Download'}
        </button>
      </div>
    </div>
  )
}
