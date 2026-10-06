// Keeps the open workout on this device so it still shows (and can be
// edited) if the app is reopened with no signal.
const key = (id) => `liahona.workout.${id}`

export function readWorkoutCache(id) {
  try {
    return JSON.parse(localStorage.getItem(key(id)))
  } catch {
    return null
  }
}

export function writeWorkoutCache(id, data) {
  try {
    localStorage.setItem(key(id), JSON.stringify({ ...data, savedAt: Date.now() }))
  } catch {
    /* storage full — the online copy is still the source of truth */
  }
}

export function clearWorkoutCache(id) {
  try {
    localStorage.removeItem(key(id))
  } catch {
    /* ignore */
  }
}
