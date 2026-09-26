import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { fetchGoals, TIERS } from '../lib/goals'
import { fetchHabits } from '../lib/habits'
import { track } from '../lib/saveStatus'
import GoalProgress from '../components/GoalProgress'

export default function Goals() {
  const [goals, setGoals] = useState(null)
  const [habits, setHabits] = useState([])
  const [showAchieved, setShowAchieved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([fetchGoals(), fetchHabits()])
      .then(([g, h]) => {
        setGoals(g)
        setHabits(h.filter((x) => !x.archived))
      })
      .catch((e) => setError(e.message))
  }, [])

  if (!goals) return <p className={error ? 'error' : 'muted'}>{error || 'Loading…'}</p>

  const active = goals.filter((g) => !g.completed_at)
  const achieved = goals
    .filter((g) => g.completed_at)
    .sort((a, b) => (a.completed_at < b.completed_at ? 1 : -1))

  return (
    <section className="narrow">
      <div className="page-head">
        <h1>Goals</h1>
      </div>

      {TIERS.map((tier) => (
        <div key={tier.id} className="goal-tier">
          <div className="tier-head">
            <h2 className="section-title">{tier.label}</h2>
            <span className="muted small">{tier.hint}</span>
          </div>
          <ul className="goal-list">
            {active
              .filter((g) => g.tier === tier.id)
              .map((g) => (
                <GoalCard key={g.id} goal={g} habits={habits} />
              ))}
          </ul>
          <AddGoal tier={tier.id} nextOrder={goals.length} />
        </div>
      ))}

      {achieved.length > 0 && (
        <>
          <button className="keep-done-toggle" onClick={() => setShowAchieved(!showAchieved)}>
            <span className={`chev ${showAchieved ? 'open' : ''}`} aria-hidden>
              ›
            </span>
            {achieved.length} achieved goal{achieved.length === 1 ? '' : 's'}
          </button>
          {showAchieved && (
            <ul className="goal-list">
              {achieved.map((g) => (
                <GoalCard key={g.id} goal={g} habits={habits} />
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  )
}

function GoalCard({ goal, habits }) {
  const linked = habits.filter((h) => h.goal_id === goal.id)
  return (
    <li>
      <Link to={`/goals/${goal.id}`} className="card goal-card">
        <span className="goal-title">{goal.title}</span>
        {goal.why && <span className="goal-why">{goal.why}</span>}
        <GoalProgress goal={goal} />
        {linked.length > 0 && (
          <span className="chips">
            {linked.map((h) => (
              <span key={h.id} className="chip">
                <span className="dot" style={{ background: h.color }} /> {h.name}
              </span>
            ))}
          </span>
        )}
      </Link>
    </li>
  )
}

function AddGoal({ tier, nextOrder }) {
  const [title, setTitle] = useState('')
  const [error, setError] = useState('')
  const navigate = useNavigate()

  async function add(e) {
    e.preventDefault()
    const t = title.trim()
    if (!t) return
    const { data, error } = await track(
      supabase.from('goals').insert({ title: t, tier, sort_order: nextOrder }).select('id').single(),
    )
    if (error) return setError(`Not saved — ${error.message}`)
    navigate(`/goals/${data.id}`)
  }

  return (
    <form className="goal-add" onSubmit={add}>
      <span className="plus" aria-hidden>
        +
      </span>
      <input placeholder="Add a goal" value={title} onChange={(e) => setTitle(e.target.value)} aria-label="New goal" />
      {error && <span className="error">{error}</span>}
    </form>
  )
}
