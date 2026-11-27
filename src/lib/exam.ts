import { supabase } from './supabase'

/** Remaining whole seconds until `deadlineIso`, measured against the server clock offset. */
export function secondsLeft(deadlineIso: string, serverOffsetMs: number, now = Date.now()) {
  return Math.max(0, Math.floor((new Date(deadlineIso).getTime() - (now + serverOffsetMs)) / 1000))
}

export function fmtCountdown(totalSeconds: number) {
  const s = Math.max(0, totalSeconds)
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = s % 60
  if (d > 0) return `${d}d ${h}h ${m}m`
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
}

/** Suggested exam month = registration month + 3 (mirrors public.suggested_exam_month). */
export function suggestedExamMonth(registeredIso: string) {
  const d = new Date(registeredIso)
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 3, 1))
}

/**
 * Shrinks a phone photo of an answer page to ~1600 px on the long side as JPEG.
 * Typical result: 150–350 KB, which keeps total storage inside the free tier.
 */
export async function compressImage(file: File, maxSide = 1600, quality = 0.72): Promise<Blob> {
  const bitmap = await createImageBitmap(file).catch(() => null)
  if (!bitmap) return file
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const w = Math.round(bitmap.width * scale)
  const h = Math.round(bitmap.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return file
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, w, h)
  ctx.drawImage(bitmap, 0, 0, w, h)
  bitmap.close?.()
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', quality))
  return blob && blob.size < file.size ? blob : file
}

/**
 * Uploads to a private Storage bucket with real progress events (XMLHttpRequest).
 * The Storage policy on the server decides whether the upload is allowed (own session, before the deadline).
 */
export async function uploadWithProgress(bucket: string, path: string, blob: Blob, onProgress: (pct: number) => void): Promise<void> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('NOT_AUTHENTICATED')
  const base = import.meta.env.VITE_SUPABASE_URL as string
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${base}/storage/v1/object/${bucket}/${path.split('/').map(encodeURIComponent).join('/')}`)
    xhr.setRequestHeader('Authorization', `Bearer ${token}`)
    xhr.setRequestHeader('apikey', key)
    xhr.setRequestHeader('x-upsert', 'true')
    xhr.setRequestHeader('Content-Type', blob.type || 'image/jpeg')
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100))
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve()
      let msg = `UPLOAD_FAILED_${xhr.status}`
      try {
        const j = JSON.parse(xhr.responseText)
        if (/row-level security|unauthorized|policy/i.test(j.message ?? j.error ?? '')) msg = 'EXAM_CLOSED'
      } catch {
        /* ignore */
      }
      reject(new Error(msg))
    }
    xhr.onerror = () => reject(new Error('NetworkError: upload interrupted'))
    xhr.send(blob)
  })
}

export async function signedUrl(bucket: string, path: string, expiresIn = 600) {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn)
  if (error) throw error
  return data.signedUrl
}

export const RESULT_TEMPLATE_HEADERS = ['UID', 'Name', 'Marks', 'Remarks', 'Result (PASS/FAIL/ABSENT/WITHHELD)']

/** Normalises spreadsheet rows (array of header→value objects) into import rows. */
export function normaliseResultRows(rows: Record<string, unknown>[]) {
  const pick = (r: Record<string, unknown>, ...names: string[]) => {
    for (const k of Object.keys(r)) {
      const kk = k.toLowerCase().replace(/[^a-z]/g, '')
      if (names.some((n) => kk.startsWith(n))) return r[k]
    }
    return undefined
  }
  return rows
    .map((r) => ({
      uid: String(pick(r, 'uid', 'memberid') ?? '').trim().toUpperCase(),
      marks: pick(r, 'marks', 'score') === undefined || pick(r, 'marks', 'score') === '' ? '' : String(pick(r, 'marks', 'score')),
      remarks: String(pick(r, 'remarks', 'remark', 'comment') ?? '').trim(),
      result: String(pick(r, 'result', 'status') ?? '').trim().toLowerCase().split(/[^a-z]/)[0],
    }))
    .filter((r) => r.uid || r.marks || r.result)
}
