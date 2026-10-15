// The states a habit cell can be in, and the tap order between them.
//   done     ✓  full effort
//   minimum  ✓  (hollow) just the bare minimum — still counts
//   missed   ✕
// Blank (no record) means not marked.
export const NEXT_STATUS = { none: 'done', done: 'minimum', minimum: 'missed', missed: 'none' }

// Done and minimum both count toward streaks and completion.
export const counts = (status) => status === 'done' || status === 'minimum'

export const SYMBOL = { done: '✓', minimum: '✓', missed: '✕' }

export const LABEL = { none: 'blank', done: 'done', minimum: 'minimum only', missed: 'missed' }
