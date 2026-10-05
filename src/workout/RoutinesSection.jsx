import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { track } from '../lib/saveStatus'
import { fetchRoutineData, startFromRoutine } from './routines'
import { uuid } from './lib'

const COLLAPSED_KEY = 'liahona.routines.collapsed'

function readCollapsed() {
  try {
    return new Set(JSON.parse(localStorage.getItem(COLLAPSED_KEY)) ?? [])
  } catch {
    return new Set()
  }
}

// Routines on the Workout tab, grouped into folders, each with a Start button.
export default function RoutinesSection() {
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState('')

  const load = () =>
    fetchRoutineData()
      .then(setData)
      .catch((e) => setError(e.message))

  useEffect(() => {
    load()
  }, [])

  function toggle(folderId) {
    const next = new Set(collapsed)
    next.has(folderId) ? next.delete(folderId) : next.add(folderId)
    setCollapsed(next)
    try {
      localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...next]))
    } catch {
      /* per-device preference only */
    }
  }

  async function write(query) {
    const { error } = await track(query)
    setError(error ? `Not saved — ${error.message}` : '')
    if (!error) await load()
    return !error
  }

  async function newRoutine(folderId = null) {
    const id = uuid()
    if (await write(supabase.from('routines').insert({ id, name: 'New routine', folder_id: folderId })))
      navigate(`/workout/routine/${id}`)
  }

  function newFolder() {
    const name = window.prompt('Folder name (e.g. "4-day split")')?.trim()
    if (name) write(supabase.from('routine_folders').insert({ name, sort_order: data.folders.length }))
  }

  function renameFolder(f) {
    const name = window.prompt('Rename folder', f.name)?.trim()
    if (name && name !== f.name) write(supabase.from('routine_folders').update({ name }).eq('id', f.id))
  }

  function deleteFolder(f) {
    if (window.confirm(`Delete the folder "${f.name}"? Its routines are kept and moved out of the folder.`))
      write(supabase.from('routine_folders').delete().eq('id', f.id))
  }

  async function start(routine) {
    setBusy(routine.id)
    try {
      const res = await startFromRoutine(routine)
      if (res.existing && !window.confirm('You already have a workout in progress. Go to it?')) return
      navigate(`/workout/${res.id}`)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(null)
    }
  }

  if (!data) return error ? <p className="error">{error}</p> : null

  const groups = [
    ...data.folders.map((f) => ({ folder: f, routines: data.routines.filter((r) => r.folder_id === f.id) })),
  ]
  const unfiled = data.routines.filter((r) => !r.folder_id || !data.folders.some((f) => f.id === r.folder_id))

  const card = (r) => (
    <li key={r.id} className="card routine-card">
      <Link to={`/workout/routine/${r.id}`} className="grow routine-card-body">
        <strong>{r.name}</strong>
        <span className="muted small">
          {r.routine_exercises.length
            ? r.routine_exercises.map((re) => re.exercises?.name).join(' · ')
            : 'No exercises yet — tap to edit'}
        </span>
      </Link>
      <button
        className="btn primary small"
        onClick={() => start(r)}
        disabled={busy === r.id || !r.routine_exercises.length}
      >
        {busy === r.id ? '…' : 'Start'}
      </button>
    </li>
  )

  return (
    <section className="routines">
      <div className="history-head">
        <h2 className="section-title">Routines</h2>
        <span className="routine-actions">
          <button className="link-btn" onClick={() => newRoutine()}>
            + Routine
          </button>
          <button className="link-btn" onClick={newFolder}>
            + Folder
          </button>
        </span>
      </div>
      {error && <p className="error">{error}</p>}

      {data.routines.length === 0 && data.folders.length === 0 && (
        <p className="muted small">
          Save a routine to start the same workout with one tap. Make one here, or open a past workout and choose
          “Save as routine”.
        </p>
      )}

      {groups.map(({ folder, routines }) => {
        const open = !collapsed.has(folder.id)
        return (
          <div key={folder.id} className="folder">
            <div className="folder-head">
              <button className="folder-toggle" onClick={() => toggle(folder.id)} aria-expanded={open}>
                <span className={`chev ${open ? 'open' : ''}`} aria-hidden>
                  ›
                </span>
                <strong>{folder.name}</strong>
                <span className="muted small">{routines.length}</span>
              </button>
              <button className="link-btn" onClick={() => newRoutine(folder.id)} title="New routine in this folder">
                +
              </button>
              <button className="link-btn" onClick={() => renameFolder(folder)}>
                Rename
              </button>
              <button className="link-btn danger-text" onClick={() => deleteFolder(folder)}>
                Delete
              </button>
            </div>
            {open && (
              <ul className="routine-list">
                {routines.length ? routines.map(card) : <li className="muted small">Empty folder.</li>}
              </ul>
            )}
          </div>
        )
      })}

      {unfiled.length > 0 && (
        <div className="folder">
          {groups.length > 0 && (
            <div className="folder-head">
              <span className="folder-toggle static">
                <strong>Other routines</strong>
              </span>
            </div>
          )}
          <ul className="routine-list">{unfiled.map(card)}</ul>
        </div>
      )}
    </section>
  )
}
