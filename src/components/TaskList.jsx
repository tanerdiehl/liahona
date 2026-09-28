import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

// Keep-style open list: drag handle, checkbox, tap-to-edit title, and a
// "+ List item" row. `limit` shows only the first N (used on the Dashboard).
export default function TaskList({ api, limit, goalTitles = {}, compact }) {
  const items = limit ? api.open.slice(0, limit) : api.open
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  return (
    <ul className={`keep-list ${compact ? 'compact' : ''}`}>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={({ active, over }) => over && api.reorder(active.id, over.id)}
      >
        <SortableContext items={items.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {items.map((t) => (
            <TaskRow key={t.id} task={t} api={api} goalTitle={goalTitles[t.goal_id]} />
          ))}
        </SortableContext>
      </DndContext>
      <li className="keep-add">
        <AddRow api={api} />
      </li>
    </ul>
  )
}

function TaskRow({ task, api, goalTitle }) {
  const [editing, setEditing] = useState(false)
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    disabled: task.pending,
  })

  return (
    <li
      ref={setNodeRef}
      className={`${isDragging ? 'dragging' : ''} ${task.pending ? 'pending' : ''}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <button
        ref={setActivatorNodeRef}
        className="drag-handle"
        aria-label={`Reorder ${task.title}`}
        {...attributes}
        {...listeners}
      >
        ⠿
      </button>
      <button
        className="box"
        disabled={task.pending}
        onClick={(e) => api.complete(task, e.currentTarget)}
        aria-label={`Complete ${task.title}`}
      />
      {editing ? (
        <input
          className="keep-edit"
          defaultValue={task.title}
          autoFocus
          onBlur={(e) => {
            setEditing(false)
            // Empty is allowed — blank items work as spacers.
            const title = e.target.value.trim()
            if (title !== task.title) api.rename(task, title)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
            if (e.key === 'Escape') setEditing(false)
          }}
        />
      ) : (
        <span className={`keep-title ${task.title ? '' : 'blank'}`} onClick={() => !task.pending && setEditing(true)}>
          {task.title}
        </span>
      )}
      {goalTitle && (
        <Link to={`/goals/${task.goal_id}`} className="chip goal-chip" title="Linked goal">
          {goalTitle}
        </Link>
      )}
      <button
        className="icon-btn keep-x"
        disabled={task.pending}
        onClick={() => (!task.title || window.confirm(`Delete "${task.title}"?`)) && api.remove(task)}
        aria-label="Delete task"
      >
        ×
      </button>
    </li>
  )
}

function AddRow({ api }) {
  const [draft, setDraft] = useState('')
  const ref = useRef(null)
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault()
        // Enter on an empty line adds a blank spacer item, like Google Keep.
        const title = draft.trim()
        // Clear immediately so the next item can be typed right away; the
        // text comes back if the save fails.
        setDraft('')
        ref.current?.focus()
        if (!(await api.add(title))) setDraft(title)
      }}
    >
      <span className="plus" aria-hidden>
        +
      </span>
      <input
        ref={ref}
        placeholder="List item"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        aria-label="New task"
      />
    </form>
  )
}
