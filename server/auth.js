import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

const COOKIE = 'vfa_admin'
const TTL_MS = 12 * 60 * 60 * 1000

// Without SESSION_SECRET, sessions simply end whenever the server restarts.
const secret = process.env.SESSION_SECRET || randomBytes(32).toString('hex')
const sign = (value) => createHmac('sha256', secret).update(value).digest('base64url')
const digest = (value) => createHash('sha256').update(String(value)).digest()

// The dashboard stays off until a real password is set: never the .env.example placeholder or a short one.
export const adminConfigured = () => {
  const pw = process.env.ADMIN_PASSWORD || ''
  return pw.length >= 8 && pw !== 'change-me'
}

export function passwordMatches(candidate) {
  if (!adminConfigured()) return false
  return timingSafeEqual(digest(candidate), digest(process.env.ADMIN_PASSWORD))
}

function readCookie(req) {
  const header = req.headers.cookie || ''
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=')
    if (k === COOKIE) return decodeURIComponent(v.join('='))
  }
  return null
}

export function isAuthenticated(req) {
  const token = readCookie(req)
  if (!token) return false
  const [expires, mac] = token.split('.')
  if (!expires || !mac || Number(expires) < Date.now()) return false
  const expected = Buffer.from(sign(expires))
  const given = Buffer.from(mac)
  return expected.length === given.length && timingSafeEqual(expected, given)
}

const cookieFlags = (maxAgeSeconds) =>
  [
    `Max-Age=${maxAgeSeconds}`,
    'Path=/api/admin',
    'HttpOnly',
    'SameSite=Strict',
    process.env.NODE_ENV === 'production' ? 'Secure' : null,
  ]
    .filter(Boolean)
    .join('; ')

export function startSession(res) {
  const expires = String(Date.now() + TTL_MS)
  res.setHeader('Set-Cookie', `${COOKIE}=${expires}.${sign(expires)}; ${cookieFlags(TTL_MS / 1000)}`)
}

export function endSession(res) {
  res.setHeader('Set-Cookie', `${COOKIE}=; ${cookieFlags(0)}`)
}

export function requireAdmin(req, res, next) {
  if (isAuthenticated(req)) return next()
  res.status(401).json({ error: 'Sign in to view enquiries.' })
}
