import { useCallback, useEffect, useState } from 'react'
import { arrayMove } from '@dnd-kit/sortable'
import { supabase } from './supabase'
import { fetchAll } from './habits'
import { track } from './saveStatus'
import { burst } from './celebrate'
import { startOfWeek, todayISO } from './dates'

const byOrder = (a, b) => a.sort_order - b.sort_order || (a.created_at < b.created_at ? -1 : 1)

// Shared to-do state for the To-do page and the Dashboard. Every change
// shows on screen immediately, then saves; a failed save puts things back
// and shows an error.
// list: 'todo' (main list) or 'week' (this week's list).
export function useTasks(list = 'todo') {
  const [tasks, setTasks] = useState(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      setTasks(await fetchAll(() => supabase.from('tasks').select('*').order('created_at')))
    } catch (e) {
      setError(e.message)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function update(id, fields) {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...fields } : t)))
    const { error } = await track(supabase.from('tasks').update(fields).eq('id', id))
    if (error) {
      setError(`Not saved — ${error.message}`)
      load()
    } else setError('')
    return !error
  }

  // Returns true once saved. The new item appears instantly.
  async function add(title, extra = {}) {
    const open = (tasks ?? []).filter((t) => !t.completed_at && (t.list ?? 'todo') === list)
    const sort_order = Math.max(0, ...open.map((t) => t.sort_order)) + 1
    const temp = {
      id: `tmp-${Date.now()}`,
      title,
      sort_order,
      completed_at: null,
      created_at: new Date().toISOString(),
      goal_id: extra.goal_id ?? null,
      list,
      week_start: list === 'week' ? startOfWeek(todayISO()) : null,
      pending: true,
    }
    setTasks((prev) => [...prev, temp])
    const { data, error } = await track(supabase.from('tasks').insert({ title, sort_order, list, week_start: temp.week_start, ...extra }).select().single())
    if (error) {
      setTasks((prev) => prev.filter((t) => t.id !== temp.id))
      setError(`Not saved — ${error.message}`)
      return false
    }
    setTasks((prev) => prev.map((t) => (t.id === temp.id ? data : t)))
    setError('')
    return true
  }

  function complete(task, el) {
    burst(el)
    return update(task.id, { completed_at: new Date().toISOString() })
  }

  const reopen = (task) => update(task.id, { completed_at: null })
  const rename = (task, title) => update(task.id, { title })

  async function remove(task) {
    setTasks((prev) => prev.filter((t) => t.id !== task.id))
    const { error } = await track(supabase.from('tasks').delete().eq('id', task.id))
    if (error) {
      setError(`Not deleted — ${error.message}`)
      load()
    }
  }

  const mine = tasks ? tasks.filter((t) => (t.list ?? 'todo') === list) : []
  const open = mine.filter((t) => !t.completed_at).sort(byOrder)
  const done = mine.filter((t) => t.completed_at).sort((a, b) => (a.completed_at < b.completed_at ? 1 : -1))

  // Drag-and-drop: give the moved item a value between its new neighbours.
  function reorder(activeId, overId) {
    const from = open.findIndex((t) => t.id === activeId)
    const to = open.findIndex((t) => t.id === overId)
    if (from < 0 || to < 0 || from === to) return
    const moved = arrayMove(open, from, to)
    const prev = moved[to - 1]
    const next = moved[to + 1]
    const sort_order =
      prev && next ? (prev.sort_order + next.sort_order) / 2 : prev ? prev.sort_order + 1 : next.sort_order - 1
    update(activeId, { sort_order })
  }

  return { tasks, open, done, error, add, complete, reopen, rename, remove, reorder }
}
