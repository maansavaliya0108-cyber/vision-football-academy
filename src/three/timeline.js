// Scroll story timeline. Everything is driven by scroll progress p ∈ [0, 1], written by the page
// into storyState; the scene reads it every frame.

// holdIntro: while the opening film plays, the particles wait to fly in until it hands over.
export const storyState = { progress: 0, pointerX: 0, pointerY: 0, pointerAt: -Infinity, reduced: false, introAt: null, holdIntro: false }

export const clamp01 = (v) => Math.min(1, Math.max(0, v))
export const smooth = (v) => v * v * (3 - 2 * v)
/** 0 → 1 as p moves from a to b, eased. */
export const span = (p, a, b) => smooth(clamp01((p - a) / (b - a)))

/**
 * Which formation the particles are in, as a continuous stage number:
 * 0 ball · 1 the word THINK. · 2 pitch and players · 3 the pass · 4 wordmark.
 * Holds give each formation time on screen while its copy is being read.
 */
const STAGE_KEYS = [
  [0, 0],
  [0.1, 0],
  [0.28, 1],
  [0.38, 1],
  [0.54, 2],
  [0.64, 2],
  [0.74, 3],
  [0.84, 3],
  [0.96, 4],
  [1, 4],
]

export function stageAt(p) {
  for (let i = 0; i < STAGE_KEYS.length - 1; i++) {
    const [p0, s0] = STAGE_KEYS[i]
    const [p1, s1] = STAGE_KEYS[i + 1]
    if (p <= p1) return s0 + (s1 - s0) * smooth(clamp01((p - p0) / (p1 - p0)))
  }
  return 4
}

/** 0 → 1 over the first moments after the scene appears: the particles fly in and form the ball. */
export function introProgress(now = performance.now()) {
  if (storyState.introAt == null) return 0
  if (storyState.reduced) return 1
  const t = clamp01((now - storyState.introAt) / 3200)
  return 1 - Math.pow(1 - t, 3)
}
