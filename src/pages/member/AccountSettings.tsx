import { KeyRound, Monitor, Moon, Save, Sun, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Alert, Button, Card, cx, Input, Modal, PageHeader, Select, Toggle } from '../../components/ui'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'
import { useDocumentTitle } from '../../hooks/useAsync'
import { api } from '../../lib/api'
import { friendlyError } from '../../lib/errors'
import { supabase } from '../../lib/supabase'
import { ageFromDob, fieldErrors, INDIAN_STATES, passwordSchema, profileSchema } from '../../lib/validation'
import { PasswordInput } from '../auth/Login'

export default function AccountSettingsPage() {
  useDocumentTitle('Account settings')
  const { profile, refreshProfile, signOut } = useAuth()
  const { toast, theme, setTheme } = useApp()
  const navigate = useNavigate()
  const [form, setForm] = useState({
    full_name: profile?.full_name ?? '',
    phone: profile?.phone?.replace(/^\+91/, '') ?? '',
    date_of_birth: profile?.date_of_birth ?? '',
    exam_preference: profile?.exam_preference ?? 'offline',
    guardian_name: profile?.guardian_name ?? '',
    guardian_phone: profile?.guardian_phone?.replace(/^[+]91/, '') ?? '',
    address_line1: profile?.address_line1 ?? '',
    address_line2: profile?.address_line2 ?? '',
    city: profile?.city ?? '',
    state: profile?.state ?? '',
    pincode: profile?.pincode ?? '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [pw, setPw] = useState({ next: '', confirm: '' })
  const [pwErr, setPwErr] = useState('')
  const [pwBusy, setPwBusy] = useState(false)
  const [delOpen, setDelOpen] = useState(false)
  const [delText, setDelText] = useState('')
  const [delBusy, setDelBusy] = useState(false)
  const [delErr, setDelErr] = useState('')

  if (!profile) return null
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function saveProfile(e: FormEvent) {
    e.preventDefault()
    const parsed = profileSchema.safeParse(form)
    if (!parsed.success) return setErrors(fieldErrors(parsed.error))
    setErrors({})
    setSaving(true)
    const d = parsed.data
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: d.full_name, phone: d.phone || null, date_of_birth: d.date_of_birth, age: ageFromDob(d.date_of_birth), exam_preference: d.exam_preference, guardian_name: d.guardian_name || null, guardian_phone: d.guardian_phone || null, address_line1: d.address_line1, address_line2: d.address_line2 || null, city: d.city, state: d.state, pincode: d.pincode })
      .eq('id', profile!.id)
    setSaving(false)
    if (error) return toast(friendlyError(error), 'error')
    await refreshProfile()
    toast(d.phone !== profile!.phone ? 'Saved. Please verify your new mobile number.' : 'Profile saved')
  }

  async function changePassword(e: FormEvent) {
    e.preventDefault()
    const p = passwordSchema.safeParse(pw.next)
    if (!p.success) return setPwErr(p.error.issues[0].message)
    if (pw.next !== pw.confirm) return setPwErr('Passwords do not match.')
    setPwErr('')
    setPwBusy(true)
    const { error } = await supabase.auth.updateUser({ password: pw.next })
    setPwBusy(false)
    if (error) return setPwErr(friendlyError(error))
    setPw({ next: '', confirm: '' })
    toast('Password changed')
  }

  async function toggleLeaderboard(v: boolean) {
    const { error } = await supabase.from('profiles').update({ show_on_leaderboard: v }).eq('id', profile!.id)
    if (error) return toast(friendlyError(error), 'error')
    await refreshProfile()
    toast(v ? 'You are visible on the leaderboard' : 'You are hidden from the leaderboard')
  }

  async function deleteAccount() {
    setDelBusy(true)
    setDelErr('')
    try {
      await api.deleteAccount(delText)
      await signOut()
      navigate('/', { replace: true })
    } catch (e) {
      setDelErr(friendlyError(e))
    } finally {
      setDelBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="Account settings" sanskrit="खातासंयोजनम्" />

      <Card className="p-5 sm:p-7">
        <h2 className="mb-5 text-xl text-ink">Personal details</h2>
        <form onSubmit={saveProfile} className="space-y-4" noValidate>
          <Input label="Full name" value={form.full_name} onChange={set('full_name')} error={errors.full_name} required autoComplete="name" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Date of birth" type="date" max={new Date().toISOString().slice(0, 10)} value={form.date_of_birth} onChange={set('date_of_birth')} error={errors.date_of_birth} required />
            <Select label="Final exam preference" value={form.exam_preference} onChange={set('exam_preference')} options={[{ value: 'online', label: 'Online' }, { value: 'offline', label: 'Offline (paper by post)' }]} />
          </div>
          <Input label={(ageFromDob(form.date_of_birth) ?? 18) < 18 ? 'Your own mobile (optional)' : 'Mobile number'} type="tel" value={form.phone} onChange={set('phone')} error={errors.phone} hint="Changing it requires verifying again" />
          {(ageFromDob(form.date_of_birth) ?? 18) < 18 && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Parent / guardian name" value={form.guardian_name} onChange={set('guardian_name')} error={errors.guardian_name} required />
              <Input label="Parent / guardian mobile" type="tel" value={form.guardian_phone} onChange={set('guardian_phone')} error={errors.guardian_phone} required />
            </div>
          )}
          <Input label="Email" value={profile.email} disabled hint="Contact us to change your email address" />
          {profile.member_uid && <Input label="Member ID (permanent)" value={profile.member_uid} disabled />}
          <h3 className="pt-3 text-lg text-ink">Postal address</h3>
          <Input label="House / flat, street" value={form.address_line1} onChange={set('address_line1')} error={errors.address_line1} required autoComplete="address-line1" />
          <Input label="Area / landmark" value={form.address_line2} onChange={set('address_line2')} error={errors.address_line2} autoComplete="address-line2" />
          <div className="grid gap-4 sm:grid-cols-3">
            <Input label="City / town" value={form.city} onChange={set('city')} error={errors.city} required />
            <Select label="State" value={form.state} onChange={set('state')} error={errors.state} options={INDIAN_STATES.map((s) => ({ value: s, label: s }))} placeholder="Select" required />
            <Input label="PIN code" value={form.pincode} onChange={set('pincode')} error={errors.pincode} maxLength={6} inputMode="numeric" required />
          </div>
          <Button type="submit" loading={saving} icon={<Save className="size-4" />}>Save changes</Button>
        </form>
      </Card>

      <Card className="space-y-5 p-5 sm:p-7">
        <h2 className="text-xl text-ink">Preferences</h2>
        <div>
          <p className="mb-2 text-sm font-semibold text-ink">Appearance</p>
          <div className="grid grid-cols-3 gap-2">
            {([['light', Sun, 'Light'], ['dark', Moon, 'Dark'], ['system', Monitor, 'System']] as const).map(([v, Icon, l]) => (
              <button key={v} onClick={() => setTheme(v)} className={cx('flex flex-col items-center gap-1.5 rounded-xl border-2 p-3 text-sm font-semibold', theme === v ? 'border-maroon bg-maroon-soft text-maroon-ink' : 'border-line text-ink-2')}>
                <Icon className="size-5" /> {l}
              </button>
            ))}
          </div>
        </div>
        <Toggle checked={profile.show_on_leaderboard} onChange={toggleLeaderboard} label="Show me on the leaderboard" description="Others see only your first name and initial." />
      </Card>

      <Card className="p-5 sm:p-7">
        <h2 className="mb-5 text-xl text-ink">Change password</h2>
        <form onSubmit={changePassword} className="space-y-4" noValidate>
          {pwErr && <Alert tone="danger">{pwErr}</Alert>}
          <PasswordInput label="New password" autoComplete="new-password" value={pw.next} onChange={(e) => setPw((p) => ({ ...p, next: e.target.value }))} />
          <PasswordInput label="Confirm new password" autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw((p) => ({ ...p, confirm: e.target.value }))} />
          <Button type="submit" variant="secondary" loading={pwBusy} icon={<KeyRound className="size-4" />}>Update password</Button>
        </form>
      </Card>

      <Card className="border-danger/30 p-5 sm:p-7">
        <h2 className="text-xl text-danger">Delete account</h2>
        <p className="mt-2 text-sm text-ink-3">Permanently delete your account and learning progress. Receipts for contributions are retained as required by law.</p>
        <Button variant="danger" className="mt-4" icon={<Trash2 className="size-4" />} onClick={() => setDelOpen(true)}>Delete my account</Button>
      </Card>

      <Modal
        open={delOpen}
        onClose={() => setDelOpen(false)}
        title="Delete your account?"
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setDelOpen(false)}>Cancel</Button>
            <Button variant="danger" disabled={delText !== 'DELETE'} loading={delBusy} onClick={deleteAccount}>Delete permanently</Button>
          </>
        }
      >
        {delErr && <Alert tone="danger" className="mb-3">{delErr}</Alert>}
        <p className="text-sm text-ink-2">This cannot be undone. Type <strong>DELETE</strong> to confirm.</p>
        <Input label="Confirmation" value={delText} onChange={(e) => setDelText(e.target.value)} wrapperClass="mt-3" />
      </Modal>
    </div>
  )
}
