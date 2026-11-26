import { Save, UserPlus, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button, Card, Input, PageHeader, SkeletonCards, Textarea, Toggle } from '../../components/ui'
import { useApp } from '../../context/AppContext'
import { useAsync, useDocumentTitle } from '../../hooks/useAsync'
import { friendlyError } from '../../lib/errors'
import { supabase } from '../../lib/supabase'
import type { AppSettings } from '../../types'

export default function AdminSettings() {
  useDocumentTitle('Settings')
  const { settings, reloadSettings, toast } = useApp()
  const [s, setS] = useState<AppSettings | null>(settings)
  const [busy, setBusy] = useState(false)
  const allow = useAsync(async () => {
    const { data } = await supabase.from('admin_allowlist').select('email, created_at').order('created_at')
    return data ?? []
  }, [])
  const [newAdmin, setNewAdmin] = useState('')

  useEffect(() => setS(settings), [settings])
  if (!s) return <SkeletonCards count={2} />
  const set = <K extends keyof AppSettings>(k: K, v: AppSettings[K]) => setS((x) => (x ? { ...x, [k]: v } : x))
  const numIn = (k: keyof AppSettings, label: string, hint?: string, min = 0, max = 100000) => (
    <Input label={label} hint={hint} type="number" min={min} max={max} value={String(s[k] ?? '')} onChange={(e) => set(k, Number(e.target.value) as never)} />
  )

  async function save() {
    setBusy(true)
    const { suggested_contribution, min_contribution, programme_days, default_pass_percentage, sequential_unlock, daily_question_count, weekly_question_count, weekly_pass_percentage, final_exam_min_weekly_passed, require_phone_verification, contact_email, contact_phone, contact_whatsapp, contact_address, maintenance_mode, maintenance_message } = s!
    const { error } = await supabase
      .from('app_settings')
      .update({ suggested_contribution, min_contribution, programme_days, default_pass_percentage, sequential_unlock, daily_question_count, weekly_question_count, weekly_pass_percentage, final_exam_min_weekly_passed, require_phone_verification, contact_email: contact_email || null, contact_phone: contact_phone || null, contact_whatsapp: contact_whatsapp || null, contact_address: contact_address || null, maintenance_mode, maintenance_message: maintenance_message || null })
      .eq('id', 1)
    setBusy(false)
    if (error) return toast(friendlyError(error), 'error')
    await reloadSettings()
    toast('Settings saved')
  }

  async function addAdmin() {
    const email = newAdmin.trim().toLowerCase()
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return toast('Enter a valid email', 'error')
    const { error } = await supabase.from('admin_allowlist').insert({ email })
    if (error) return toast(friendlyError(error), 'error')
    setNewAdmin('')
    allow.reload()
    toast('Added. This email becomes an admin when it registers. Existing members can be promoted from their profile.')
  }
  async function removeAdmin(email: string) {
    await supabase.from('admin_allowlist').delete().eq('email', email)
    allow.reload()
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader title="Settings" subtitle="Programme rules, Guru Dakshina and contact details. Changes are recorded in the audit log." actions={<Button loading={busy} icon={<Save className="size-4" />} onClick={save}>Save settings</Button>} />

      <Card className="space-y-4 p-5 sm:p-6">
        <h2 className="text-xl text-ink">Guru Dakshina</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {numIn('suggested_contribution', 'Suggested amount (₹)', 'Shown as the suggested contribution', 1)}
          {numIn('min_contribution', 'Minimum amount (₹)', undefined, 1)}
        </div>
      </Card>

      <Card className="space-y-4 p-5 sm:p-6">
        <h2 className="text-xl text-ink">Learning programme</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {numIn('programme_days', 'Target duration (days)', 'Guidance only – never locks members', 1, 3650)}
          {numIn('default_pass_percentage', 'Default pass mark (%)', 'Used for new chapters', 1, 100)}
          {numIn('daily_question_count', 'Daily challenge questions', undefined, 1, 30)}
          {numIn('weekly_question_count', 'Weekly challenge questions', undefined, 1, 50)}
          {numIn('weekly_pass_percentage', 'Weekly pass mark (%)', undefined, 1, 100)}
          {numIn('final_exam_min_weekly_passed', 'Weekly challenges required for final exam', '0 = only chapters required', 0, 100)}
        </div>
        <Toggle checked={s.sequential_unlock} onChange={(v) => set('sequential_unlock', v)} label="Unlock chapters in order" description="Members must complete a chapter before the next one unlocks" />
        <Toggle checked={s.require_phone_verification} onChange={(v) => set('require_phone_verification', v)} label="Prompt members to verify their mobile number" description="Requires an SMS provider to be configured" />
      </Card>

      <Card className="space-y-4 p-5 sm:p-6">
        <h2 className="text-xl text-ink">Contact details</h2>
        <p className="text-sm text-ink-3">Shown on the website and used by the chatbot when it cannot answer.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Email" type="email" value={s.contact_email ?? ''} onChange={(e) => set('contact_email', e.target.value)} />
          <Input label="Phone" value={s.contact_phone ?? ''} onChange={(e) => set('contact_phone', e.target.value)} />
          <Input label="WhatsApp" value={s.contact_whatsapp ?? ''} onChange={(e) => set('contact_whatsapp', e.target.value)} />
          <Input label="Address" value={s.contact_address ?? ''} onChange={(e) => set('contact_address', e.target.value)} />
        </div>
      </Card>

      <Card className="space-y-4 p-5 sm:p-6">
        <h2 className="text-xl text-ink">Maintenance mode</h2>
        <Toggle checked={s.maintenance_mode} onChange={(v) => set('maintenance_mode', v)} label="Show maintenance page to members" description="Admins can still sign in and use the app" />
        <Textarea label="Maintenance message" value={s.maintenance_message ?? ''} onChange={(e) => set('maintenance_message', e.target.value)} rows={2} />
      </Card>

      <Card className="space-y-4 p-5 sm:p-6">
        <h2 className="text-xl text-ink">Admin sign-up allowlist</h2>
        <p className="text-sm text-ink-3">Emails listed here automatically become admins when they register.</p>
        <div className="flex gap-2">
          <Input label="Email" value={newAdmin} onChange={(e) => setNewAdmin(e.target.value)} wrapperClass="flex-1" />
          <Button className="mt-7" variant="secondary" icon={<UserPlus className="size-4" />} onClick={addAdmin}>Add</Button>
        </div>
        <ul className="divide-y divide-line">
          {(allow.data ?? []).map((a) => (
            <li key={a.email} className="flex items-center justify-between py-2 text-sm">
              <span>{a.email}</span>
              <button onClick={() => removeAdmin(a.email)} className="rounded p-1 text-ink-3 hover:bg-surface-2" aria-label={`Remove ${a.email}`}><X className="size-4" /></button>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}
