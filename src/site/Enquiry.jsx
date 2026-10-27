import { useId, useRef, useState } from 'react'
import { academy, experienceLevels } from '../../shared/academy.js'
import { STATIC } from '../config'
import { ChatIcon, PhoneIcon, TickIcon } from './icons'
import { SectionTitle } from './SectionTitle'

const empty = {
  playerName: '',
  playerAge: '',
  guardianName: '',
  phone: '',
  email: '',
  experience: '',
  preferredDay: 'Any weekday',
  message: '',
  consent: false,
  website: '',
}

// Mirrors the server's rules so most mistakes are caught before sending.
function validate(v) {
  const e = {}
  if (v.playerName.trim().length < 2) e.playerName = 'Enter the player’s name'
  const age = Number(v.playerAge)
  if (!v.playerAge) e.playerAge = 'Enter the player’s age'
  else if (!Number.isInteger(age) || age < 4 || age > 60) e.playerAge = 'Enter an age between 4 and 60'
  const digits = v.phone.replace(/[\s\-()]/g, '').replace(/^(\+?91|0)(?=\d{10}$)/, '')
  if (!/^[6-9]\d{9}$/.test(digits)) e.phone = 'Enter a 10-digit Indian mobile number'
  if (v.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email)) e.email = 'Enter a valid email address or leave it blank'
  if (!v.program) e.program = 'Choose a program'
  if (!v.experience) e.experience = 'Choose the player’s experience'
  if (!v.consent) e.consent = 'Tick the box so the academy can call you back'
  return e
}

function Field({ id, label, hint, error, children, wide }) {
  return (
    <div className={`field ${wide ? 'field--wide' : ''} ${error ? 'has-error' : ''}`}>
      <label htmlFor={id}>{label}</label>
      {hint && (
        <p className="field__hint" id={`${id}-hint`}>
          {hint}
        </p>
      )}
      {children}
      {error && (
        <p className="field__error" id={`${id}-error`}>
          {error}
        </p>
      )}
    </div>
  )
}

export function Enquiry({ program, onProgramChange }) {
  const [values, setValues] = useState(empty)
  const [errors, setErrors] = useState({})
  const [state, setState] = useState({ phase: 'idle' })
  const form = useRef(null)
  const uid = useId()
  const id = (name) => `${uid}-${name}`
  const all = { ...values, program }

  const set = (name) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    if (name === 'program') onProgramChange(value)
    else setValues((v) => ({ ...v, [name]: value }))
    if (errors[name]) setErrors(({ [name]: _, ...rest }) => rest)
  }

  const describe = (name, hint) =>
    [hint && `${id(name)}-hint`, errors[name] && `${id(name)}-error`].filter(Boolean).join(' ') || undefined

  const submit = async (e) => {
    e.preventDefault()
    const found = validate(all)
    setErrors(found)
    if (Object.keys(found).length) {
      form.current.querySelector(`[name="${Object.keys(found)[0]}"]`)?.focus()
      return
    }
    if (STATIC) {
      // No server on the static site: hand the enquiry to WhatsApp, written out and ready to send.
      const program = academy.programs.find((p) => p.id === all.program)?.name
      const experience = experienceLevels.find((l) => l.id === all.experience)?.label
      const lines = [
        'Hi, I would like to enquire about Vision Football Academy.',
        `Player: ${all.playerName.trim()}, age ${all.playerAge}`,
        all.guardianName.trim() && `Parent or guardian: ${all.guardianName.trim()}`,
        `Mobile: ${all.phone}`,
        all.email.trim() && `Email: ${all.email.trim()}`,
        `Program: ${program}`,
        `Experience: ${experience}`,
        `Best day to visit: ${all.preferredDay}`,
        all.message.trim() && `Note: ${all.message.trim()}`,
      ].filter(Boolean)
      window.open(whatsapp(lines.join('\n')), '_blank', 'noopener')
      setState({ phase: 'sent', ref: null, playerName: all.playerName.trim(), phone: all.phone, text: lines.join('\n') })
      return
    }
    setState({ phase: 'sending' })
    try {
      const res = await fetch('/api/enquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(all),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setState({ phase: 'sent', ref: data.ref, playerName: all.playerName.trim(), phone: all.phone })
        return
      }
      if (data.fields) setErrors(data.fields)
      setState({ phase: 'error', message: data.error || 'The enquiry did not go through. Try again, or call the academy.' })
    } catch {
      setState({
        phase: 'error',
        message: 'Your connection dropped before the enquiry was sent. Check your internet and try again, or call the academy.',
      })
    }
  }

  const reset = () => {
    setValues(empty)
    onProgramChange('')
    setState({ phase: 'idle' })
  }

  const whatsapp = (text) => `https://wa.me/${academy.phone.whatsapp}?text=${encodeURIComponent(text)}`

  return (
    <section className="join" id="join" aria-labelledby="join-title">
      <div className="wrap join__grid">
        <div className="join__intro">
          <SectionTitle id="join-title">Join the academy</SectionTitle>
          <p>
            Tell us about the player and the academy will call you back to talk through programs and arrange a visit
            to the ground.
          </p>
          <div className="join__direct">
            <p>Prefer to talk now?</p>
            <a href={`tel:${academy.phone.tel}`}>
              <PhoneIcon width={18} height={18} />
              Call {academy.phone.display}
            </a>
            <a href={whatsapp('Hi, I would like to enquire about joining Vision Football Academy.')} target="_blank" rel="noreferrer">
              <ChatIcon width={18} height={18} />
              Message on WhatsApp
            </a>
          </div>
        </div>

        {state.phase === 'sent' ? (
          <div className="sent" role="status" tabIndex={-1} ref={(el) => el?.focus()}>
            <span className="sent__icon">
              <TickIcon width={28} height={28} />
            </span>
            <h3>{state.ref ? 'Enquiry sent' : 'Almost there'}</h3>
            {state.ref ? (
              <p>
                Thanks. The academy will call you on <strong>{state.phone}</strong> about {state.playerName}. Your
                reference is <strong className="sent__ref">{state.ref}</strong>.
              </p>
            ) : (
              <p>
                WhatsApp has opened with the enquiry for <strong>{state.playerName}</strong> written out. Press send
                there to deliver it to the academy.
              </p>
            )}
            <div className="sent__actions">
              <a
                className="btn btn--ink"
                href={whatsapp(state.ref ? `Hi, I just sent enquiry ${state.ref} for ${state.playerName}.` : state.text)}
                target="_blank"
                rel="noreferrer"
              >
                <ChatIcon width={18} height={18} />
                {state.ref ? 'Follow up on WhatsApp' : 'Open WhatsApp again'}
              </a>
              <button type="button" className="btn btn--plain" onClick={reset}>
                Send another enquiry
              </button>
            </div>
          </div>
        ) : (
          <form className="form" ref={form} onSubmit={submit} noValidate>
            <Field id={id('playerName')} label="Player’s name" error={errors.playerName}>
              <input
                id={id('playerName')}
                name="playerName"
                autoComplete="off"
                value={values.playerName}
                onChange={set('playerName')}
                aria-invalid={Boolean(errors.playerName)}
                aria-describedby={describe('playerName')}
              />
            </Field>
            <Field id={id('playerAge')} label="Age" error={errors.playerAge}>
              <input
                id={id('playerAge')}
                name="playerAge"
                inputMode="numeric"
                value={values.playerAge}
                onChange={set('playerAge')}
                aria-invalid={Boolean(errors.playerAge)}
                aria-describedby={describe('playerAge')}
              />
            </Field>
            <Field
              id={id('guardianName')}
              label="Parent or guardian (optional)"
              hint="Leave blank if the player is an adult."
              error={errors.guardianName}
            >
              <input
                id={id('guardianName')}
                name="guardianName"
                autoComplete="name"
                value={values.guardianName}
                onChange={set('guardianName')}
                aria-describedby={describe('guardianName', true)}
              />
            </Field>
            <Field id={id('phone')} label="Mobile number" hint="The academy will call this number." error={errors.phone}>
              <input
                id={id('phone')}
                name="phone"
                type="tel"
                autoComplete="tel"
                inputMode="tel"
                placeholder="98765 43210"
                value={values.phone}
                onChange={set('phone')}
                aria-invalid={Boolean(errors.phone)}
                aria-describedby={describe('phone', true)}
              />
            </Field>
            <Field id={id('program')} label="Program" error={errors.program}>
              <select
                id={id('program')}
                name="program"
                value={program}
                onChange={set('program')}
                aria-invalid={Boolean(errors.program)}
                aria-describedby={describe('program')}
              >
                <option value="" disabled>
                  Choose a program
                </option>
                {academy.programs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field id={id('experience')} label="Experience" error={errors.experience}>
              <select
                id={id('experience')}
                name="experience"
                value={values.experience}
                onChange={set('experience')}
                aria-invalid={Boolean(errors.experience)}
                aria-describedby={describe('experience')}
              >
                <option value="" disabled>
                  Choose one
                </option>
                {experienceLevels.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field id={id('email')} label="Email (optional)" error={errors.email}>
              <input
                id={id('email')}
                name="email"
                type="email"
                autoComplete="email"
                value={values.email}
                onChange={set('email')}
                aria-invalid={Boolean(errors.email)}
                aria-describedby={describe('email')}
              />
            </Field>
            <Field id={id('preferredDay')} label="Best day to visit">
              <select id={id('preferredDay')} name="preferredDay" value={values.preferredDay} onChange={set('preferredDay')}>
                {['Any weekday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            </Field>
            <Field id={id('message')} label="Anything the coaches should know? (optional)" wide error={errors.message}>
              <textarea
                id={id('message')}
                name="message"
                rows={3}
                maxLength={1000}
                placeholder="Position, injuries, goals, questions about fees"
                value={values.message}
                onChange={set('message')}
              />
            </Field>
            <div className="field--trap" aria-hidden="true">
              <label htmlFor={id('website')}>Leave this empty</label>
              <input id={id('website')} name="website" tabIndex={-1} autoComplete="off" value={values.website} onChange={set('website')} />
            </div>
            <div className={`field field--wide field--check ${errors.consent ? 'has-error' : ''}`}>
              <label className="check">
                <input
                  type="checkbox"
                  name="consent"
                  checked={values.consent}
                  onChange={set('consent')}
                  aria-invalid={Boolean(errors.consent)}
                  aria-describedby={errors.consent ? `${id('consent')}-error` : undefined}
                />
                <span>The academy can call or WhatsApp me about this enquiry.</span>
              </label>
              {errors.consent && (
                <p className="field__error" id={`${id('consent')}-error`}>
                  {errors.consent}
                </p>
              )}
            </div>
            {state.phase === 'error' && (
              <p className="form__alert" role="alert">
                {state.message}
              </p>
            )}
            <div className="form__submit">
              <button className="btn btn--volt" type="submit" disabled={state.phase === 'sending'}>
                {state.phase === 'sending' ? 'Sending enquiry' : STATIC ? 'Send on WhatsApp' : 'Send enquiry'}
              </button>
            </div>
          </form>
        )}
      </div>
    </section>
  )
}
