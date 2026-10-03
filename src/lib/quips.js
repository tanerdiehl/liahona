// Short lines for habit check-off pop-ups. (Daily scripture and quotes live
// in inspiration.js.)

export const HABIT_DONE = [
  'Small and simple things.',
  'That counts. Keep going.',
  'Future you says thanks.',
  'Consistency beats intensity.',
  'Showing up is the whole game.',
]

export const ALL_HABITS_DONE = [
  'Every habit, done. That’s a full day.',
  'Clean sweep today.',
  'All of them. Well done, good and faithful servant.',
  'Today is handled. Rest well.',
]

export const pick = (list) => list[Math.floor(Math.random() * list.length)]
