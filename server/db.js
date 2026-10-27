import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { randomBytes } from 'node:crypto'

const file = resolve(process.env.DATABASE_PATH || 'data/academy.db')
mkdirSync(dirname(file), { recursive: true })

export const db = new DatabaseSync(file)
db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS enquiries (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    ref           TEXT NOT NULL UNIQUE,
    created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    player_name   TEXT NOT NULL,
    player_age    INTEGER NOT NULL,
    guardian_name TEXT,
    phone         TEXT NOT NULL,
    email         TEXT,
    program       TEXT NOT NULL,
    experience    TEXT NOT NULL,
    preferred_day TEXT,
    message       TEXT,
    status        TEXT NOT NULL DEFAULT 'new',
    notes         TEXT
  );
  CREATE INDEX IF NOT EXISTS enquiries_created ON enquiries (created_at DESC);
  CREATE INDEX IF NOT EXISTS enquiries_status ON enquiries (status);
`)

export const STATUSES = ['new', 'contacted', 'trial', 'enrolled', 'closed']

// Short, unambiguous reference a parent can quote on the phone (no 0/O or 1/I).
const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'
const newRef = () =>
  'VFA-' +
  Array.from(randomBytes(5), (b) => ALPHABET[b % ALPHABET.length]).join('')

const insert = db.prepare(`
  INSERT INTO enquiries (ref, player_name, player_age, guardian_name, phone, email, program, experience, preferred_day, message)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`)

export function createEnquiry(e) {
  const ref = newRef()
  insert.run(
    ref,
    e.playerName,
    e.playerAge,
    e.guardianName || null,
    e.phone,
    e.email || null,
    e.program,
    e.experience,
    e.preferredDay || null,
    e.message || null,
  )
  return ref
}

export function listEnquiries({ status, q } = {}) {
  const where = []
  const args = []
  if (status && STATUSES.includes(status)) {
    where.push('status = ?')
    args.push(status)
  }
  if (q) {
    where.push('(player_name LIKE ? OR guardian_name LIKE ? OR phone LIKE ? OR ref LIKE ?)')
    const like = `%${q}%`
    args.push(like, like, like, like)
  }
  const sql = `SELECT * FROM enquiries ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY created_at DESC LIMIT 500`
  return db.prepare(sql).all(...args)
}

export function updateEnquiry(id, { status, notes }) {
  const sets = []
  const args = []
  if (status !== undefined) {
    sets.push('status = ?')
    args.push(status)
  }
  if (notes !== undefined) {
    sets.push('notes = ?')
    args.push(notes || null)
  }
  if (!sets.length) return null
  sets.push("updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')")
  const result = db.prepare(`UPDATE enquiries SET ${sets.join(', ')} WHERE id = ?`).run(...args, id)
  if (!result.changes) return null
  return db.prepare('SELECT * FROM enquiries WHERE id = ?').get(id)
}

export function enquiryStats() {
  const total = db.prepare('SELECT COUNT(*) AS n FROM enquiries').get().n
  const lastWeek = db
    .prepare("SELECT COUNT(*) AS n FROM enquiries WHERE created_at >= strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-7 days')")
    .get().n
  const byStatus = Object.fromEntries(STATUSES.map((s) => [s, 0]))
  for (const row of db.prepare('SELECT status, COUNT(*) AS n FROM enquiries GROUP BY status').all()) {
    byStatus[row.status] = row.n
  }
  const byProgram = db.prepare('SELECT program, COUNT(*) AS n FROM enquiries GROUP BY program ORDER BY n DESC').all()
  return { total, lastWeek, byStatus, byProgram }
}
