// The chapters of the "How to play" video, shared by its renderer (tutorial/main.js) and the game
// page, which lists them so a viewer can jump to any part. Each runs for `seconds`, in this order.
export const TUTORIAL_CHAPTERS = [
  { id: 'intro', title: 'The Vision Test', seconds: 4.5 },
  { id: 'you', title: 'You, the pitch and the goal', seconds: 7 },
  { id: 'look', title: 'Look around', seconds: 9 },
  { id: 'memory', title: 'Memory ghosts', seconds: 10 },
  { id: 'ball', title: 'The ball comes from behind', seconds: 9 },
  { id: 'pass', title: 'Pass to the open teammate', seconds: 10 },
  { id: 'lane', title: 'Covered lanes', seconds: 8.5 },
  { id: 'press', title: 'The presser', seconds: 9 },
  { id: 'check', title: 'Check your shoulder', seconds: 10.5 },
  { id: 'stale', title: 'Memories go stale', seconds: 9 },
  { id: 'first', title: 'First-time passes', seconds: 11 },
  { id: 'levels', title: 'Five levels', seconds: 9 },
  { id: 'switch', title: 'Level 2: the cover switches', seconds: 9.5 },
  { id: 'two', title: 'Level 4: two pressers', seconds: 10.5 },
  { id: 'score', title: 'How you score', seconds: 10 },
  { id: 'results', title: 'Your results and vision map', seconds: 9 },
  { id: 'practice', title: 'Practice and keyboard play', seconds: 8.5 },
  { id: 'end', title: 'Play it', seconds: 6 },
].reduce((list, c) => [...list, { ...c, at: list.length ? list[list.length - 1].at + list[list.length - 1].seconds : 0 }], [])

export const TUTORIAL_SECONDS = TUTORIAL_CHAPTERS.reduce((s, c) => s + c.seconds, 0)
