import { dismissToast, useToasts } from '../lib/celebrate'

export default function Toaster() {
  const toasts = useToasts()
  return (
    <div className="toaster" aria-live="polite">
      {toasts.map((t) => (
        <button
          key={t.id}
          className="toast"
          style={t.color ? { '--toast-accent': t.color } : undefined}
          onClick={() => dismissToast(t.id)}
        >
          <strong>{t.title}</strong>
          {t.body && <span>{t.body}</span>}
        </button>
      ))}
    </div>
  )
}
