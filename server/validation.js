import { z } from 'zod'
import { programIds, experienceLevels } from '../shared/academy.js'
import { STATUSES } from './db.js'

const trimmed = (max) => z.string().trim().max(max)
const optionalText = (max) =>
  trimmed(max)
    .optional()
    .transform((v) => v || undefined)

// Accepts "+91 90335 13330", "090335-13330", "9033513330" and stores the bare 10 digits.
const indianMobile = z
  .string()
  .transform((v) => v.replace(/[\s\-()]/g, '').replace(/^(\+?91|0)(?=\d{10}$)/, ''))
  .pipe(z.string().regex(/^[6-9]\d{9}$/, 'Enter a 10-digit Indian mobile number'))

export const enquirySchema = z.object({
  playerName: trimmed(80).min(2, 'Enter the player’s name'),
  playerAge: z.coerce
    .number({ error: 'Enter the player’s age' })
    .int('Enter the age in whole years')
    .min(4, 'Players start from age 4')
    .max(60, 'Enter an age under 60'),
  guardianName: optionalText(80),
  phone: indianMobile,
  email: z
    .union([z.literal(''), z.email('Enter a valid email address or leave it blank')])
    .optional()
    .transform((v) => v || undefined),
  program: z.enum(programIds, { error: 'Choose a program' }),
  experience: z.enum(
    experienceLevels.map((l) => l.id),
    { error: 'Choose the player’s experience' },
  ),
  preferredDay: z
    .enum(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Any weekday'])
    .optional(),
  message: optionalText(1000),
  consent: z.literal(true, { error: 'Tick the box so the academy can call you back' }),
  // Honeypot: real visitors never see this field.
  website: z.string().max(0).optional(),
})

export const updateSchema = z
  .object({
    status: z.enum(STATUSES).optional(),
    notes: z.string().trim().max(2000).optional(),
  })
  .refine((v) => v.status !== undefined || v.notes !== undefined, 'Nothing to update')

export function fieldErrors(error) {
  const out = {}
  for (const issue of error.issues) {
    const key = issue.path[0] ?? 'form'
    out[key] ??= issue.message
  }
  return out
}
