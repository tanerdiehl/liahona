// Small encouragements shown in toasts and empty states. Scripture lines
// are public-domain (KJV / Book of Mormon).

export const HABIT_DONE = [
  'Small and simple things.',
  'That counts. Keep going.',
  'Another brick in the wall you’re building.',
  'Future you says thanks.',
  'Consistency beats intensity.',
  'Showing up is the whole game.',
  'One more day of becoming.',
]

export const ALL_HABITS_DONE = [
  'Every habit, done. That’s a full day.',
  'Clean sweep today.',
  'All of them. Well done, good and faithful servant.',
  'Today is handled. Rest well.',
]

export const TASK_DONE = ['Done.', 'Off your plate.', 'Checked.', 'One less thing.', 'Nice.', 'Crossed off.']

export const TODO_EMPTY = [
  'Nothing on the list. Enjoy the quiet.',
  'All clear — go live a little.',
  'Empty list, full life.',
  'You’re caught up.',
]

export const DAILY = [
  '“Men are, that they might have joy.” — 2 Nephi 2:25',
  '“I can do all things through Christ which strengtheneth me.” — Philippians 4:13',
  '“Be still, and know that I am God.” — Psalm 46:10',
  '“By small and simple things are great things brought to pass.” — Alma 37:6',
  '“Let us run with patience the race that is set before us.” — Hebrews 12:1',
  '“This is the day which the Lord hath made; we will rejoice and be glad in it.” — Psalm 118:24',
  '“Trust in the Lord with all thine heart.” — Proverbs 3:5',
  'You don’t rise to your goals; you fall to your systems.',
  'Do the minimum on hard days. Never zero.',
  'Discipline is remembering what you want.',
  'Plan the week, then work the plan.',
  'Rest is part of the work.',
]

export const pick = (list) => list[Math.floor(Math.random() * list.length)]

// Same pick all day, changes tomorrow.
export function pickForDay(list, iso) {
  let h = 0
  for (const c of iso) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return list[h % list.length]
}
