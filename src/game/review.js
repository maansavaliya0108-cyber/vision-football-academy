// How a match went, in words: the rating and the coach's note shown after the whistle, shared by the
// game page and the how-to-play video.
import { FIRST_TIME_BONUS, LEVELS } from './visionTest'

// The rating at the end, from the moment players stop scanning to the academy's own line.
const TIERS = [
  [4500, 'One pass ahead'],
  [2500, 'Scanning'],
  [1000, 'Checking'],
  [0, 'Head down'],
]
export const tierFor = (score) => TIERS.find(([min]) => score >= min)[1]

/** One line of coaching from how the match went: the biggest thing to work on next. */
export function tipFor(r) {
  if (r.rounds === 0) return 'Look around the pitch, and pass to the open teammate when the ball reaches you.'
  if (r.pressSpotted < 0.5)
    return 'Look over both shoulders before the ball is played. Spot every presser and time slows as the ball arrives.'
  if (r.heavyTouches >= 2) return 'Watch the ball in: look at it before it reaches you, or your first touch is heavy.'
  if (r.tackled >= 2) return 'You saw the press but held the ball. Know your pass before it arrives.'
  if (r.intercepted >= 2) return 'Look along the line of the pass, not just at the player: find the lane nobody is in.'
  if (r.misplaced >= 2) return 'Memories go stale. Look at a runner again before you pass to them.'
  if (r.firstTime === 0)
    return `Next step: choose your pass while the ball is still coming and play it first time, for ${FIRST_TIME_BONUS} extra points.`
  if (r.mode === 'match' && r.level < 5) return `Keep the streak going to reach level ${r.level + 1}, ${LEVELS[r.level].name}.`
  return 'One pass ahead. Now do it on grass at Boghara School Ground.'
}
