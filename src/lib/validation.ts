import { z } from 'zod'

export const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana',
  'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
  'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana',
  'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Andaman and Nicobar Islands', 'Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry',
]

/** Normalise an Indian mobile number to E.164 (+91XXXXXXXXXX). Returns null if invalid. */
export function normalizeIndianMobile(input: string): string | null {
  const digits = input.replace(/[^\d+]/g, '')
  let d = digits.startsWith('+') ? digits.slice(1) : digits
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2)
  else if (d.length === 11 && d.startsWith('0')) d = d.slice(1)
  if (!/^[6-9]\d{9}$/.test(d)) return null
  return `+91${d}`
}

export const passwordSchema = z
  .string()
  .min(8, 'Use at least 8 characters')
  .max(72, 'Use at most 72 characters')
  .regex(/[A-Za-z]/, 'Include at least one letter')
  .regex(/\d/, 'Include at least one number')

export function passwordStrength(pw: string): { score: 0 | 1 | 2 | 3 | 4; label: string } {
  let score = 0
  if (pw.length >= 8) score++
  if (pw.length >= 12) score++
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score++
  const labels = ['Too weak', 'Weak', 'Fair', 'Good', 'Strong']
  return { score: score as 0 | 1 | 2 | 3 | 4, label: labels[score] }
}

const name = z.string().trim().min(2, 'Enter your full name').max(100, 'Name is too long')

export const addressSchema = z.object({
  address_line1: z.string().trim().min(5, 'Enter house / street details').max(200),
  address_line2: z.string().trim().max(200).optional().or(z.literal('')),
  city: z.string().trim().min(2, 'Enter your city or town').max(100),
  state: z.string().trim().min(2, 'Select your state').max(100),
  pincode: z.string().trim().regex(/^[1-9]\d{5}$/, 'Enter a valid 6-digit PIN code'),
})

/** Whole years between a YYYY-MM-DD date of birth and today (India time). */
export function ageFromDob(dob: string, today: Date = new Date()): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob ?? '')) return null
  const [y, m, d] = dob.split('-').map(Number)
  const [ty, tm, td] = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(today).split('-').map(Number)
  let age = ty - y
  if (tm < m || (tm === m && td < d)) age--
  return age
}

/**
 * Member UID preview – mirrors public.member_uid_base() in the database:
 * first four Latin letters of the name (spaces ignored, padded with X) + last four digits of the applicable phone.
 * Collisions get -2, -3 … on the server; the final UID is always assigned by the database.
 */
export function memberUidBase(fullName: string, applicablePhone: string | null | undefined) {
  const letters = (fullName ?? '').replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, 4).padEnd(4, 'X')
  const digits = (applicablePhone ?? '').replace(/\D/g, '').slice(-4).padStart(4, '0')
  return letters + digits
}

const optionalPhone = z
  .string()
  .trim()
  .optional()
  .or(z.literal(''))
  .refine((v) => !v || normalizeIndianMobile(v) !== null, 'Enter a valid 10-digit Indian mobile number')
  .transform((v) => (v ? (normalizeIndianMobile(v) as string) : ''))

const dobField = z
  .string()
  .trim()
  .refine((v) => ageFromDob(v) !== null, 'Enter your date of birth')
  .refine((v) => {
    const a = ageFromDob(v)
    return a !== null && a >= 5 && a <= 120
  }, 'Enter a valid date of birth (age 5–120)')

/** Adults (18+) give their own phone; minors give a parent/guardian name and phone (siblings may share it). */
function contactRules(v: { date_of_birth: string; phone: string; guardian_name?: string; guardian_phone: string }, ctx: z.RefinementCtx) {
  const age = ageFromDob(v.date_of_birth)
  if (age === null) return
  if (age >= 18 && !v.phone) ctx.addIssue({ code: 'custom', path: ['phone'], message: 'Enter your mobile number' })
  if (age < 18) {
    if (!v.guardian_phone) ctx.addIssue({ code: 'custom', path: ['guardian_phone'], message: 'Enter a parent or guardian mobile number' })
    if (!v.guardian_name || v.guardian_name.trim().length < 2) ctx.addIssue({ code: 'custom', path: ['guardian_name'], message: 'Enter the parent or guardian name' })
  }
}

export const registerSchema = z
  .object({
    full_name: name,
    email: z.string().trim().toLowerCase().email('Enter a valid email address').max(200),
    date_of_birth: dobField,
    exam_preference: z.enum(['online', 'offline'], { message: 'Choose online or offline' }),
    phone: optionalPhone,
    guardian_name: z.string().trim().max(100).optional().or(z.literal('')),
    guardian_phone: optionalPhone,
    password: passwordSchema,
    confirm_password: z.string(),
    accept_terms: z.literal(true, { message: 'Please accept the Terms and Privacy Policy' }),
  })
  .merge(addressSchema)
  .superRefine((v, ctx) => {
    contactRules(v, ctx)
    if (v.password !== v.confirm_password) ctx.addIssue({ code: 'custom', path: ['confirm_password'], message: 'Passwords do not match' })
  })

export type RegisterInput = z.input<typeof registerSchema>
export type RegisterData = z.output<typeof registerSchema>

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password'),
})

export const profileSchema = z
  .object({
    full_name: name,
    date_of_birth: dobField,
    exam_preference: z.enum(['online', 'offline']),
    phone: optionalPhone,
    guardian_name: z.string().trim().max(100).optional().or(z.literal('')),
    guardian_phone: optionalPhone,
  })
  .merge(addressSchema)
  .superRefine(contactRules)

export const contactSchema = z.object({
  name,
  email: z.string().trim().email('Enter a valid email address'),
  phone: z.string().trim().max(20).optional().or(z.literal('')),
  message: z.string().trim().min(5, 'Please write a short message').max(3000),
})

export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? '_')
    if (!out[key]) out[key] = issue.message
  }
  return out
}
