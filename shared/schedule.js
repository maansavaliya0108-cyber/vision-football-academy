import { academy } from './academy.js'

const toMinutes = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

export const formatTime = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number)
  const suffix = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 || 12
  return m ? `${hour}:${String(m).padStart(2, '0')} ${suffix}` : `${hour} ${suffix}`
}

// Wall-clock day and minutes in the academy's timezone, whatever the viewer's timezone is.
export function academyClock(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: academy.timezone,
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(now)
  const get = (type) => parts.find((p) => p.type === type).value
  const dow = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'))
  return { dow, minutes: Number(get('hour')) * 60 + Number(get('minute')) }
}

/**
 * Where the academy is in its week right now.
 * Returns { live, label, detail } where label is short enough for a badge.
 */
export function trainingStatus(now = new Date()) {
  const { dow, minutes } = academyClock(now)
  const byDow = new Map(academy.schedule.map((d) => [d.dow, d]))
  const today = byDow.get(dow)

  if (today?.open) {
    const open = toMinutes(today.open)
    const close = toMinutes(today.close)
    if (minutes >= open && minutes < close) {
      const left = close - minutes
      return {
        live: true,
        label: 'Training now',
        detail: `On the pitch until ${formatTime(today.close)} (${left} min left)`,
      }
    }
    if (minutes < open) {
      const wait = open - minutes
      const h = Math.floor(wait / 60)
      const m = wait % 60
      return {
        live: false,
        label: `Today at ${formatTime(today.open)}`,
        detail: `Next session starts in ${h ? `${h} h ` : ''}${m} min`,
      }
    }
  }

  for (let i = 1; i <= 7; i++) {
    const next = byDow.get((dow + i) % 7)
    if (next?.open) {
      const when = i === 1 ? 'Tomorrow' : next.day
      return {
        live: false,
        label: `${when} at ${formatTime(next.open)}`,
        detail: `Next session: ${next.day}, ${formatTime(next.open)} to ${formatTime(next.close)}`,
      }
    }
  }
  return { live: false, label: 'Schedule to be announced', detail: '' }
}
