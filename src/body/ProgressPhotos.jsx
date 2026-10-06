import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { track } from '../lib/saveStatus'
import { formatLong, formatShort, todayISO } from '../lib/dates'
import { deletePhoto, fetchPhotos, fileDate, signedUrls, uploadPhoto } from './photos'
import { fetchBodyLogs, round1 } from './body'
import { convertWeight, loadSettings } from '../workout/lib'

const monthFmt = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' })

// /photos — timeline of progress photos, plus side-by-side compare.
export default function ProgressPhotos() {
  const [photos, setPhotos] = useState(null)
  const [urls, setUrls] = useState({})
  const [weights, setWeights] = useState([])
  const [unit, setUnit] = useState('lbs')
  const [viewing, setViewing] = useState(null)
  const [compare, setCompare] = useState(null) // null | [] | [a] | [a, b]
  const [error, setError] = useState('')

  async function load() {
    try {
      const [list, settings, logs] = await Promise.all([fetchPhotos(), loadSettings(), fetchBodyLogs().catch(() => [])])
      setPhotos(list)
      setUnit(settings.weight_unit)
      setWeights(
        logs
          .filter((l) => l.bodyweight != null)
          .map((l) => ({ date: l.log_date, w: convertWeight(Number(l.bodyweight), l.weight_unit, settings.weight_unit) })),
      )
      setUrls(await signedUrls(list.map((p) => p.storage_path)))
    } catch (e) {
      setError(e.message)
    }
  }

  useEffect(() => {
    load()
  }, [])

  // Closest bodyweight on or before a photo's date, for context.
  const weightOn = (date) => {
    const w = [...weights].reverse().find((x) => x.date <= date)
    return w ? `${round1(w.w)} ${unit}` : null
  }

  const groups = useMemo(() => {
    const out = []
    for (const p of photos ?? []) {
      const m = p.taken_on.slice(0, 7)
      if (!out.length || out.at(-1).month !== m) out.push({ month: m, items: [] })
      out.at(-1).items.push(p)
    }
    return out
  }, [photos])

  function tap(p) {
    if (!compare) return setViewing(p)
    const has = compare.some((c) => c.id === p.id)
    const next = has ? compare.filter((c) => c.id !== p.id) : [...compare, p].slice(-2)
    setCompare(next)
  }

  if (!photos) return <p className={error ? 'error' : 'muted'}>{error || 'Loading…'}</p>

  const pair = compare?.length === 2 ? [...compare].sort((a, b) => (a.taken_on < b.taken_on ? -1 : 1)) : null

  return (
    <section className="narrow photos">
      <div className="page-head">
        <Link to="/body" className="btn ghost small">
          ‹ Body
        </Link>
        {photos.length > 1 && (
          <button className="btn ghost small" onClick={() => setCompare(compare ? null : [])}>
            {compare ? 'Done comparing' : 'Compare'}
          </button>
        )}
      </div>
      <h1>Progress photos</h1>

      {error && <p className="error">{error}</p>}

      {compare ? (
        pair ? (
          <div className="compare-pair">
            {pair.map((p) => (
              <figure key={p.id}>
                <img src={urls[p.storage_path]} alt={`Progress photo ${formatLong(p.taken_on)}`} />
                <figcaption>
                  <strong>{formatShort(p.taken_on)}</strong>
                  {weightOn(p.taken_on) && <span className="muted"> · {weightOn(p.taken_on)}</span>}
                </figcaption>
              </figure>
            ))}
            <p className="muted small compare-gap">
              {Math.round((new Date(pair[1].taken_on) - new Date(pair[0].taken_on)) / 864e5)} days apart
            </p>
          </div>
        ) : (
          <p className="card muted">
            Tap two photos below to compare them side by side. {compare.length === 1 && '(1 selected)'}
          </p>
        )
      ) : (
        <AddPhoto onAdded={load} onError={setError} />
      )}

      {photos.length === 0 && (
        <p className="empty-quip">Your first photo is your baseline. Future you will be glad you took it.</p>
      )}

      {groups.map((g) => (
        <div key={g.month} className="photo-month">
          <h2 className="wa-title">{monthFmt.format(new Date(g.month + '-15'))}</h2>
          <div className="photo-grid">
            {g.items.map((p) => {
              const selected = compare?.some((c) => c.id === p.id)
              return (
                <button key={p.id} className={`photo-thumb ${selected ? 'selected' : ''}`} onClick={() => tap(p)}>
                  {urls[p.storage_path] ? (
                    <img src={urls[p.storage_path]} alt={`Progress photo ${formatShort(p.taken_on)}`} loading="lazy" />
                  ) : (
                    <span className="muted small">…</span>
                  )}
                  <span className="photo-date">{formatShort(p.taken_on)}</span>
                </button>
              )
            })}
          </div>
        </div>
      ))}

      {viewing && (
        <PhotoViewer
          photo={viewing}
          url={urls[viewing.storage_path]}
          weight={weightOn(viewing.taken_on)}
          onClose={() => setViewing(null)}
          onChanged={() => {
            setViewing(null)
            load()
          }}
          onError={setError}
        />
      )}
    </section>
  )
}

function AddPhoto({ onAdded, onError }) {
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState('')
  const [date, setDate] = useState(todayISO())
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const input = useRef(null)

  function pick(e) {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setPreview(URL.createObjectURL(f))
    const d = fileDate(f)
    setDate(d > todayISO() ? todayISO() : d)
  }

  function reset() {
    if (preview) URL.revokeObjectURL(preview)
    setFile(null)
    setPreview('')
    setNote('')
    setDate(todayISO())
    if (input.current) input.current.value = ''
  }

  async function save() {
    setBusy(true)
    try {
      await uploadPhoto(file, date, note.trim())
      reset()
      onError('')
      onAdded()
    } catch (e) {
      onError(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card add-photo">
      {!file ? (
        <label className="file-pick">
          <input ref={input} type="file" accept="image/*" onChange={pick} />
          <span>📷 Add a photo</span>
        </label>
      ) : (
        <div className="add-photo-form">
          <img src={preview} alt="Selected photo" className="add-preview" />
          <div className="add-photo-fields">
            <label>
              Date taken
              <input type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value || todayISO())} />
            </label>
            <input placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
            <div className="form-actions">
              <button className="btn ghost small" onClick={reset} disabled={busy}>
                Cancel
              </button>
              <button className="btn primary small" onClick={save} disabled={busy}>
                {busy ? 'Uploading…' : 'Save photo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function PhotoViewer({ photo, url, weight, onClose, onChanged, onError }) {
  const [note, setNote] = useState(photo.note)
  const [date, setDate] = useState(photo.taken_on)

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  async function save() {
    const { error } = await track(supabase.from('progress_photos').update({ note: note.trim(), taken_on: date }).eq('id', photo.id))
    if (error) return onError(error.message)
    onChanged()
  }

  async function remove() {
    if (!window.confirm('Delete this photo permanently?')) return
    try {
      await deletePhoto(photo)
      onChanged()
    } catch (e) {
      onError(e.message)
    }
  }

  const dirty = note.trim() !== photo.note || date !== photo.taken_on

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="photo-viewer" onClick={(e) => e.stopPropagation()}>
        <img src={url} alt={`Progress photo ${formatLong(photo.taken_on)}`} />
        <div className="photo-viewer-info">
          <strong>{formatLong(photo.taken_on)}</strong>
          {weight && <span className="muted small"> · {weight}</span>}
          <div className="photo-viewer-edit">
            <input type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value || photo.taken_on)} />
            <input placeholder="Note" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <div className="form-actions">
            <button className="btn ghost small danger" onClick={remove}>
              Delete
            </button>
            <span className="grow" />
            <button className="btn ghost small" onClick={onClose}>
              Close
            </button>
            {dirty && (
              <button className="btn primary small" onClick={save}>
                Save
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
