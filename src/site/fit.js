// Advance widths, in em, of the display face's capitals: Archivo 900 at 125% width with the titles'
// tight tracking, measured in Chrome. Adding them up slightly over-estimates a word (kerning only
// ever tightens it), which is the safe direction for keeping huge single words inside a phone screen.
const CAPS = {
  A: 0.92, B: 0.9, C: 0.91, D: 0.9, E: 0.83, F: 0.78, G: 0.98, H: 0.98, I: 0.36, J: 0.73, K: 0.96, L: 0.76, M: 1.15,
  N: 0.98, O: 0.98, P: 0.83, Q: 0.98, R: 0.91, S: 0.85, T: 0.85, U: 0.96, V: 0.91, W: 1.2, X: 0.93, Y: 0.94, Z: 0.85,
  '-': 0.39, '’': 0.29, "'": 0.29, '.': 0.35, ',': 0.35, '?': 0.71, '&': 1.03,
}
const DIGIT = 0.8
const OTHER = 1

/** Inline style handing CSS the widest word's width as `--fit`, for headings capped to fit. */
export const fitStyle = (text) => ({ '--fit': widestWordEm(text).toFixed(2) })

/** Width in em of the widest word of `text`, set in capitals in the display face. */
export function widestWordEm(text) {
  return Math.max(
    ...text
      .toUpperCase()
      .split(/\s+/)
      .map((word) => [...word].reduce((sum, c) => sum + (CAPS[c] ?? (/\d/.test(c) ? DIGIT : OTHER)), 0)),
  )
}
