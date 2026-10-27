import { useCallback, useEffect, useMemo, useState } from 'react'
import { academy, experienceLevels } from '../../shared/academy.js'
import { STATIC } from '../config'
import { Mark } from '../site/Logo'
import './admin.css'

const STATUSES = [
  { id: 'new', label: 'New' },
  { id: 'contacted', label: 'Called' },
  { id: 'trial', label: 'Visited ground' },
  { id: 'enrolled', label: 'Enrolled' },
  { id: 'closed', label: 'Closed' },
]
const programName = Object.fromEntries(academy.programs.map((p) => [p.id, p.name]))
const experienceName = Object.fromEntries(experienceLevels.map((l) => [l.id, l.label]))

const when = (iso) =>
  new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: academy.timezone }).format(new Date(iso))

async function api(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    credentials: 'same-origin',
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw Object.assign(new Error(data.error || 'The server did not respond. Try again.'), { status: res.status })
  return data
}

function SignIn({ configured, onSignedIn }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await api('/api/admin/login', { method: 'POST', body: JSON.stringify({ password }) })
      onSignedIn()
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }
  return (
    <main className="adm-signin">
      <form className="adm-card" onSubmit={submit}>
        <Mark size={44} />
        <h1>Enquiries</h1>
        <p>Sign in to see enquiries sent from the website.</p>
        {!configured && <p className="adm-alert">The dashboard is turned off. Set ADMIN_PASSWORD (8 or more characters) on the server to turn it on.</p>}
        <label htmlFor="pw">Password</label>
        <input
          id="pw"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={!configured}
          autoFocus
        />
        {error && (
          <p className="adm-alert" role="alert">
            {error}
          </p>
        )}
        <button className="adm-btn adm-btn--primary" disabled={busy || !configured || !password}>
          {busy ? 'Signing in' : 'Sign in'}
        </button>
        <a className="adm-back" href="/">
          Back to the website
        </a>
      </form>
    </main>
  )
}

function Row({ e, onSave }) {
  const [open, setOpen] = useState(false)
  const [notes, setNotes] = useState(e.notes || '')
  const [saving, setSaving] = useState(false)
  const save = async (patch) => {
    setSaving(true)
    await onSave(e.id, patch)
    setSaving(false)
  }
  return (
    <>
      <tr className={`adm-row adm-row--${e.status}`}>
        <td>
          <button className="adm-expand" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
            <strong>{e.player_name}</strong>
            <span>
              Age {e.player_age}
              {e.guardian_name ? `, parent ${e.guardian_name}` : ''}
            </span>
          </button>
        </td>
        <td>
          <a href={`tel:+91${e.phone}`}>{e.phone.replace(/(\d{5})(\d{5})/, '$1 $2')}</a>
        </td>
        <td>{programName[e.program] || e.program}</td>
        <td className="adm-muted">{when(e.created_at)}</td>
        <td>
          <select
            aria-label={`Status for ${e.player_name}`}
            value={e.status}
            onChange={(ev) => save({ status: ev.target.value })}
            disabled={saving}
            className={`adm-status adm-status--${e.status}`}
          >
            {STATUSES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </td>
      </tr>
      {open && (
        <tr className="adm-detail">
          <td colSpan={5}>
            <dl>
              <div>
                <dt>Reference</dt>
                <dd>{e.ref}</dd>
              </div>
              <div>
                <dt>Experience</dt>
                <dd>{experienceName[e.experience] || e.experience || 'Not given'}</dd>
              </div>
              <div>
                <dt>Best day</dt>
                <dd>{e.preferred_day || 'Any'}</dd>
              </div>
              <div>
                <dt>Email</dt>
                <dd>{e.email ? <a href={`mailto:${e.email}`}>{e.email}</a> : 'Not given'}</dd>
              </div>
              <div className="adm-wide">
                <dt>Message</dt>
                <dd>{e.message || 'No message'}</dd>
              </div>
            </dl>
            <label className="adm-notes">
              Staff notes
              <textarea rows={2} value={notes} onChange={(ev) => setNotes(ev.target.value)} maxLength={2000} />
            </label>
            <div className="adm-detail__actions">
              <button className="adm-btn" onClick={() => save({ notes })} disabled={saving || notes === (e.notes || '')}>
                {saving ? 'Saving' : 'Save notes'}
              </button>
              <a
                className="adm-btn"
                href={`https://wa.me/91${e.phone}?text=${encodeURIComponent(`Hi${e.guardian_name ? ` ${e.guardian_name}` : ''}, this is Vision Football Academy about your enquiry for ${e.player_name}.`)}`}
                target="_blank"
                rel="noreferrer"
              >
                WhatsApp
              </a>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

function Dashboard({ onSignOut }) {
  const [data, setData] = useState(null)
  const [status, setStatus] = useState('')
  const [q, setQ] = useState('')
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (status) params.set('status', status)
      if (q.trim()) params.set('q', q.trim())
      setData(await api(`/api/admin/enquiries?${params}`))
      setError('')
    } catch (err) {
      if (err.status === 401) onSignOut()
      else setError(err.message)
    }
  }, [status, q, onSignOut])

  useEffect(() => {
    const t = setTimeout(load, q ? 250 : 0)
    return () => clearTimeout(t)
  }, [load, q])

  const save = async (id, patch) => {
    try {
      const updated = await api(`/api/admin/enquiries/${id}`, { method: 'PATCH', body: JSON.stringify(patch) })
      setData((d) => ({ ...d, enquiries: d.enquiries.map((e) => (e.id === id ? updated : e)) }))
      if (patch.status) load()
    } catch (err) {
      setError(err.message)
    }
  }

  const signOut = async () => {
    await api('/api/admin/logout', { method: 'POST' }).catch(() => {})
    onSignOut()
  }

  const stats = data?.stats
  const csvHref = useMemo(() => `/api/admin/enquiries.csv${status ? `?status=${status}` : ''}`, [status])

  return (
    <div className="adm">
      <header className="adm-top">
        <a className="adm-brand" href="/">
          <Mark size={30} />
          <span>Vision FA enquiries</span>
        </a>
        <button className="adm-btn" onClick={signOut}>
          Sign out
        </button>
      </header>
      <main className="adm-main">
        {stats && (
          <section className="adm-stats" aria-label="Summary">
            <div>
              <p className="adm-stat">{stats.total}</p>
              <p>All enquiries</p>
            </div>
            <div>
              <p className="adm-stat">{stats.lastWeek}</p>
              <p>In the last 7 days</p>
            </div>
            <div>
              <p className="adm-stat adm-stat--cone">{stats.byStatus.new}</p>
              <p>Waiting for a call</p>
            </div>
            <div>
              <p className="adm-stat">{stats.byStatus.enrolled}</p>
              <p>Enrolled</p>
            </div>
          </section>
        )}

        <div className="adm-tools">
          <div className="adm-filters" role="group" aria-label="Filter by status">
            {[{ id: '', label: 'All' }, ...STATUSES].map((s) => (
              <button key={s.id} className={`adm-chip ${status === s.id ? 'is-on' : ''}`} onClick={() => setStatus(s.id)} aria-pressed={status === s.id}>
                {s.label}
                {s.id && stats ? <span>{stats.byStatus[s.id]}</span> : null}
              </button>
            ))}
          </div>
          <input className="adm-search" type="search" placeholder="Search name, phone or reference" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search enquiries" />
          <a className="adm-btn" href={csvHref}>
            Download CSV
          </a>
        </div>

        {error && (
          <p className="adm-alert" role="alert">
            {error}
          </p>
        )}

        {!data ? (
          <p className="adm-muted">Loading enquiries</p>
        ) : data.enquiries.length === 0 ? (
          <div className="adm-empty">
            <h2>{status || q ? 'Nothing matches that filter' : 'No enquiries yet'}</h2>
            <p>
              {status || q
                ? 'Try another status or clear the search.'
                : 'Enquiries sent from the “Book a visit” form on the website will appear here.'}
            </p>
          </div>
        ) : (
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Player</th>
                  <th>Phone</th>
                  <th>Program</th>
                  <th>Received</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.enquiries.map((e) => (
                  <Row key={e.id} e={e} onSave={save} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  )
}

function AdminRoot() {
  const [session, setSession] = useState(null)
  const check = useCallback(() => {
    api('/api/admin/session')
      .then(setSession)
      .catch(() => setSession({ authenticated: false, configured: true }))
  }, [])
  useEffect(() => {
    document.title = 'Enquiries | Vision Football Academy'
    check()
  }, [check])
  const signedOut = useCallback(() => setSession((s) => ({ ...s, authenticated: false })), [])

  if (!session) return <div className="boot" aria-busy="true" />
  if (!session.authenticated) return <SignIn configured={session.configured} onSignedIn={check} />
  return <Dashboard onSignOut={signedOut} />
}

/** The shared static copy has no server, so there is nothing to sign in to. */
function StaticNotice() {
  return (
    <main className="adm-signin">
      <div className="adm-card">
        <Mark size={44} />
        <h1>Enquiries</h1>
        <p>
          The staff dashboard runs on the academy’s own server. This shared copy of the site is static, so enquiries
          from it arrive on WhatsApp instead.
        </p>
        <a className="adm-back" href={import.meta.env.BASE_URL}>
          Back to the website
        </a>
      </div>
    </main>
  )
}

export default STATIC ? StaticNotice : AdminRoot
