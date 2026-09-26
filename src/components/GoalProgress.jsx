import { goalProgress } from '../lib/goals'

export default function GoalProgress({ goal }) {
  const { pct, label } = goalProgress(goal)
  return (
    <div className="goal-progress">
      {pct != null && (
        <div className="goal-bar" role="img" aria-label={label}>
          <span className={goal.completed_at ? 'achieved' : ''} style={{ width: `${Math.round(pct * 100)}%` }} />
        </div>
      )}
      <span className={`goal-label ${pct == null ? 'status' : ''}`}>{label}</span>
    </div>
  )
}
