import { motion } from 'motion/react'
import { AlertTriangle, CalendarClock, Camera, CheckCircle2, Clock, FileDown, ImagePlus, Loader2, PlayCircle, RefreshCw, School, Send, Trash2, Trophy, Upload, XCircle } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Alert, Button, buttonClass, Card, cx, EmptyState, Modal, PageHeader, Pill, ProgressBar, SkeletonCards } from '../../components/ui'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'
import { useAsync, useDocumentTitle } from '../../hooks/useAsync'
import { api } from '../../lib/api'
import { friendlyError } from '../../lib/errors'
import { compressImage, fmtCountdown, secondsLeft, signedUrl, uploadWithProgress } from '../../lib/exam'
import { fmtDate, fmtDateTime } from '../../lib/format'
import type { MyExam } from '../../types'

interface LocalPage {
  key: string
  page_no: number
  preview: string
  status: 'compressing' | 'uploading' | 'saved' | 'failed'
  progress: number
  error?: string
  file?: File
  storage_path?: string
}

export default function ExamRoomPage() {
  useDocumentTitle('Examination')
  const { toast, online } = useApp()
  const { profile } = useAuth()
  const exam = useAsync(() => api.myExam(), [])
  const [offset, setOffset] = useState(0)
  const [now, setNow] = useState(Date.now())
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [pages, setPages] = useState<LocalPage[]>([])
  const [confirmStart, setConfirmStart] = useState(false)
  const [confirmSubmit, setConfirmSubmit] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const e = exam.data

  useEffect(() => {
    if (e?.server_now) setOffset(new Date(e.server_now).getTime() - Date.now())
  }, [e?.server_now])
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  // Show pages already saved on the server (e.g. after a refresh or network drop)
  useEffect(() => {
    const saved = e?.session?.pages ?? []
    if (!saved.length) return
    let cancelled = false
    Promise.all(saved.map(async (p) => ({ key: p.id, page_no: p.page_no, preview: await signedUrl('answer-sheets', p.storage_path).catch(() => ''), status: 'saved' as const, progress: 100, storage_path: p.storage_path }))).then((list) => {
      if (!cancelled) setPages((cur) => [...list, ...cur.filter((c) => c.status !== 'saved' && !list.some((l) => l.page_no === c.page_no))].sort((a, b) => a.page_no - b.page_no))
    })
    return () => {
      cancelled = true
    }
  }, [e?.session?.id, e?.session?.pages])

  const session = e?.session
  const writeLeft = session ? secondsLeft(session.deadline_at, offset, now) : 0
  const uploadLeft = session ? secondsLeft(session.upload_until, offset, now) : 0
  const closed = !!session && uploadLeft === 0 && session.status === 'in_progress'
  const startsIn = e?.schedule ? secondsLeft(e.schedule.exam_starts_at, offset, now) : 0
  const entryLeft = e?.schedule ? secondsLeft(e.schedule.entry_closes_at, offset, now) : 0
  const savedCount = pages.filter((p) => p.status === 'saved').length
  const pending = pages.some((p) => p.status === 'compressing' || p.status === 'uploading')

  const approved = useMemo(() => ['approved', 'paper_dispatched', 'delivered', 'exam_completed'].includes(e?.readiness?.status ?? ''), [e?.readiness?.status])

  async function start() {
    setConfirmStart(false)
    setBusy(true)
    setErr('')
    try {
      await api.startExam()
      await exam.reload()
      toast('Exam started. All the best!')
    } catch (x) {
      setErr(friendlyError(x))
    } finally {
      setBusy(false)
    }
  }

  async function openPaper() {
    try {
      const path = e?.session?.question_paper_path
      if (!path) throw new Error('PAPER_NOT_READY')
      window.open(await signedUrl('exam-papers', path, 3600), '_blank', 'noopener')
    } catch (x) {
      setErr(friendlyError(x))
    }
  }

  async function uploadPage(page: LocalPage) {
    if (!session || !page.file) return
    const update = (patch: Partial<LocalPage>) => setPages((cur) => cur.map((p) => (p.key === page.key ? { ...p, ...patch } : p)))
    try {
      update({ status: 'compressing', progress: 0, error: undefined })
      const blob = await compressImage(page.file)
      update({ status: 'uploading' })
      const path = `${profile!.id}/${session.id}/page-${String(page.page_no).padStart(2, '0')}-${Date.now()}.jpg`
      await uploadWithProgress('answer-sheets', path, blob, (pct) => update({ progress: pct }))
      await api.registerExamPage(session.id, page.page_no, path, blob.size)
      update({ status: 'saved', progress: 100, storage_path: path })
    } catch (x) {
      update({ status: 'failed', error: friendlyError(x) })
    }
  }

  async function addFiles(files: FileList | null) {
    if (!files?.length || !session) return
    const used = new Set(pages.map((p) => p.page_no))
    let next = 1
    const added: LocalPage[] = []
    for (const f of Array.from(files)) {
      if (!f.type.startsWith('image/')) continue
      while (used.has(next)) next++
      used.add(next)
      added.push({ key: crypto.randomUUID(), page_no: next, preview: URL.createObjectURL(f), status: 'compressing', progress: 0, file: f })
    }
    setPages((cur) => [...cur, ...added].sort((a, b) => a.page_no - b.page_no))
    for (const p of added) await uploadPage(p) // one at a time keeps mobile networks stable
    if (fileInput.current) fileInput.current.value = ''
  }

  async function removePage(p: LocalPage) {
    if (!session) return
    try {
      if (p.status === 'saved') await api.removeExamPage(session.id, p.page_no)
      setPages((cur) => cur.filter((x) => x.key !== p.key))
    } catch (x) {
      setErr(friendlyError(x))
    }
  }

  async function submit() {
    if (!session) return
    setConfirmSubmit(false)
    if (!navigator.onLine) return setErr('You are offline. Your uploaded pages are safe – reconnect and press SUBMIT again.')
    setBusy(true)
    setErr('')
    try {
      await api.submitExam(session.id)
      await exam.reload()
      toast('Answer sheets submitted successfully')
    } catch (x) {
      setErr(friendlyError(x))
    } finally {
      setBusy(false)
    }
  }

  if (exam.loading && !e) return <SkeletonCards count={2} />
  if (exam.error || !e) return <EmptyState title="Couldn't load your examination">{friendlyError(exam.error)}</EmptyState>

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader title="Final examination" sanskrit="परीक्षा" subtitle={e.member_uid ? `Member ID ${e.member_uid}` : undefined} actions={<Link to="/app/final-exam" className={buttonClass('outline', 'sm')}>Readiness & dispatch</Link>} />

      {/* Results */}
      {e.results.length > 0 && (
        <Card className="overflow-hidden">
          <div className="bg-gradient-to-r from-maroon to-[#4a1219] px-6 py-5 text-white">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-[#f1cf7d]"><Trophy className="size-4" /> Result</p>
          </div>
          {e.results.map((r, i) => (
            <div key={i} className="grid gap-4 p-6 sm:grid-cols-4">
              <Info label="Exam date" value={fmtDate(r.exam_date)} />
              <Info label="Type" value={r.exam_mode === 'online' ? 'Online' : 'Offline'} />
              <Info label="Marks" value={r.marks !== null ? `${r.marks} / ${r.max_marks}` : '—'} />
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-ink-3">Status</p>
                <Pill tone={r.result === 'pass' ? 'success' : r.result === 'fail' ? 'danger' : 'neutral'} className="mt-1 text-sm uppercase">{r.result}</Pill>
              </div>
              {r.remarks && <p className="text-sm text-ink-2 sm:col-span-4">Remarks: {r.remarks}</p>}
            </div>
          ))}
        </Card>
      )}

      {/* Schedule */}
      <Card className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-ink-3">Your examination</p>
            <p className="mt-1 font-display text-2xl text-ink">{e.schedule ? e.schedule.title : 'Date to be announced'}</p>
            <p className="mt-1 text-sm text-ink-2">
              {e.schedule ? <>Starts {fmtDateTime(e.schedule.exam_starts_at)} · {e.schedule.duration_minutes / 60} hours</> : <>Suggested month for your batch: <strong>{new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' }).format(new Date(e.suggested_month))}</strong>. The exact date will appear here.</>}
            </p>
          </div>
          <Pill tone={e.exam_preference === 'online' ? 'info' : 'gold'} className="text-sm">{e.exam_preference === 'online' ? 'Online exam' : 'Offline exam'}</Pill>
        </div>
        {e.schedule && !session && startsIn > 0 && (
          <div className="mt-5 flex items-center gap-3 rounded-2xl bg-surface-2 p-4">
            <CalendarClock className="size-6 text-maroon" />
            <div>
              <p className="text-xs uppercase tracking-wider text-ink-3">Countdown</p>
              <p className="font-display text-2xl tabular-nums text-ink">{fmtCountdown(startsIn)}</p>
            </div>
          </div>
        )}
        {e.schedule?.instructions && <p className="mt-4 whitespace-pre-line text-sm text-ink-2">{e.schedule.instructions}</p>}
      </Card>

      {err && <Alert tone="danger">{err}</Alert>}

      {e.exam_preference === 'offline' ? (
        <Card className="flex items-start gap-4 p-6">
          <School className="mt-1 size-7 shrink-0 text-gold" />
          <div className="text-sm text-ink-2">
            <p className="font-semibold text-ink">Offline (paper) examination</p>
            <p className="mt-1">Your question paper is posted to your registered address after the organisation approves your readiness. Track it on the <Link to="/app/final-exam" className="font-semibold text-maroon-ink underline">readiness & dispatch</Link> page. Your result will appear here once published.</p>
          </div>
        </Card>
      ) : !session ? (
        <Card className="p-6">
          {!e.readiness ? (
            <Alert tone="info">Complete all chapters and confirm “Yes, I am ready to take the Final Exam” first.</Alert>
          ) : !approved ? (
            <Alert tone="gold">Your readiness request is being reviewed. The START button will be available once the organisation approves it and the exam window opens.</Alert>
          ) : !e.schedule ? (
            <Alert tone="info">Your exam date has not been published yet.</Alert>
          ) : startsIn > 0 ? (
            <Alert tone="info" icon={<Clock className="size-5" />}>The exam opens in {fmtCountdown(startsIn)}.</Alert>
          ) : entryLeft === 0 ? (
            <Alert tone="danger">The exam entry window has closed. Please contact the organisation.</Alert>
          ) : (
            <div className="text-center">
              <p className="text-sm text-ink-2">When you press START, a {e.schedule.duration_minutes / 60}-hour timer begins. Write your answers on paper, then photograph each page and upload them here before submitting.</p>
              <Button size="lg" className="mt-5" loading={busy} disabled={!online} icon={<PlayCircle className="size-5" />} onClick={() => setConfirmStart(true)}>START EXAM</Button>
              <p className="mt-2 text-xs text-ink-3">Entry closes in {fmtCountdown(entryLeft)}</p>
            </div>
          )}
        </Card>
      ) : session.status === 'submitted' ? (
        <Card className="p-8 text-center">
          <CheckCircle2 className="mx-auto size-14 text-success" />
          <h2 className="mt-3 text-2xl text-ink">Answer sheets submitted</h2>
          <p className="mt-1 text-sm text-ink-3">Submitted {fmtDateTime(session.submitted_at)} · {session.pages_count} page{session.pages_count === 1 ? '' : 's'}. Your result will appear here after evaluation.</p>
        </Card>
      ) : session.status === 'expired' || closed ? (
        <Card className="p-8 text-center">
          <XCircle className="mx-auto size-14 text-danger" />
          <h2 className="mt-3 text-2xl text-ink">The examination time is over</h2>
          <p className="mt-1 text-sm text-ink-3">The submission window closed at {fmtDateTime(session.upload_until)}. {savedCount ? `${savedCount} page(s) were uploaded but the paper was not submitted.` : ''} Please contact the organisation.</p>
        </Card>
      ) : (
        <>
          {/* Exam in progress */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={cx('sticky top-16 z-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4 shadow-[var(--shadow-soft)]', writeLeft < 600 ? 'border-danger/40 bg-danger-soft' : 'border-line bg-surface')}>
            <div className="flex items-center gap-3">
              <Clock className={cx('size-6', writeLeft < 600 ? 'text-danger' : 'text-maroon')} />
              <div>
                <p className="text-xs uppercase tracking-wider text-ink-3">{writeLeft > 0 ? 'Writing time left' : 'Upload time left'}</p>
                <p className="font-display text-3xl tabular-nums text-ink">{fmtCountdown(writeLeft > 0 ? writeLeft : uploadLeft)}</p>
              </div>
            </div>
            <Button variant="secondary" icon={<FileDown className="size-4" />} onClick={openPaper}>Question paper (PDF)</Button>
          </motion.div>
          {writeLeft === 0 && <Alert tone="gold" icon={<AlertTriangle className="size-5" />}>Writing time is over. Upload your pages and press SUBMIT before the upload window closes.</Alert>}
          {!online && <Alert tone="danger">You are offline. Pages already uploaded are safe. Reconnect to continue uploading and to submit.</Alert>}

          <Card className="p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl text-ink">Answer sheet photos</h2>
                <p className="text-sm text-ink-3">{savedCount} page{savedCount === 1 ? '' : 's'} uploaded. Photograph each page flat, in good light, in order.</p>
              </div>
              <div className="flex gap-2">
                <input ref={fileInput} type="file" accept="image/*" multiple capture="environment" className="hidden" onChange={(ev) => addFiles(ev.target.files)} aria-label="Add answer sheet photos" />
                <Button icon={<Camera className="size-4" />} onClick={() => fileInput.current?.click()} disabled={!online}>Add pages</Button>
              </div>
            </div>
            {pages.length === 0 ? (
              <button onClick={() => fileInput.current?.click()} className="mt-5 flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-line-strong p-10 text-ink-3 hover:border-gold">
                <ImagePlus className="size-8" /> Tap to photograph or choose your answer pages
              </button>
            ) : (
              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {pages.map((p) => (
                  <div key={p.key} className="overflow-hidden rounded-xl border border-line bg-surface-2">
                    <div className="relative aspect-[3/4] bg-surface-3">
                      {p.preview && <img src={p.preview} alt={`Page ${p.page_no}`} className="size-full object-cover" />}
                      <span className="absolute left-2 top-2 rounded-md bg-ink/80 px-2 py-0.5 text-xs font-bold text-bg">Page {p.page_no}</span>
                      {p.status === 'saved' && <CheckCircle2 className="absolute right-2 top-2 size-6 rounded-full bg-white text-success" />}
                    </div>
                    <div className="space-y-1.5 p-2">
                      {(p.status === 'uploading' || p.status === 'compressing') && (
                        <>
                          <ProgressBar value={p.progress} size="sm" label={`Uploading page ${p.page_no}`} />
                          <p className="flex items-center gap-1 text-xs text-ink-3"><Loader2 className="size-3 animate-spin" /> {p.status === 'compressing' ? 'Preparing…' : `${p.progress}%`}</p>
                        </>
                      )}
                      {p.status === 'failed' && (
                        <>
                          <p className="text-xs text-danger">{p.error}</p>
                          <Button size="sm" variant="outline" className="w-full" icon={<RefreshCw className="size-3.5" />} onClick={() => uploadPage(p)}>Retry</Button>
                        </>
                      )}
                      {p.status !== 'uploading' && p.status !== 'compressing' && (
                        <button onClick={() => removePage(p)} className="flex w-full items-center justify-center gap-1 rounded-lg py-1 text-xs text-ink-3 hover:bg-danger-soft hover:text-danger"><Trash2 className="size-3.5" /> Remove</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
          <div className="flex flex-col items-center gap-2">
            <Button size="lg" variant="gold" loading={busy} disabled={savedCount === 0 || pending || !online} icon={<Send className="size-5" />} onClick={() => setConfirmSubmit(true)}>SUBMIT</Button>
            {pending && <p className="flex items-center gap-1 text-xs text-ink-3"><Upload className="size-3.5" /> Wait for uploads to finish before submitting.</p>}
          </div>
        </>
      )}

      <Modal open={confirmStart} onClose={() => setConfirmStart(false)} title="Start the examination?" footer={<><Button variant="outline" onClick={() => setConfirmStart(false)}>Not yet</Button><Button loading={busy} onClick={start}>Start now</Button></>}>
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-ink-2">
          <li>The {e.schedule?.duration_minutes ? e.schedule.duration_minutes / 60 : 3}-hour timer starts immediately and cannot be paused.</li>
          <li>Keep your answer booklet, pen and a charged phone ready.</li>
          <li>Upload clear photos of every page, then press SUBMIT. Late submissions are not accepted.</li>
        </ul>
      </Modal>
      <Modal open={confirmSubmit} onClose={() => setConfirmSubmit(false)} title="Submit your answer sheets?" footer={<><Button variant="outline" onClick={() => setConfirmSubmit(false)}>Review again</Button><Button loading={busy} onClick={submit}>Submit {savedCount} page{savedCount === 1 ? '' : 's'}</Button></>}>
        <p className="text-sm text-ink-2">After submitting you cannot add or change pages. Make sure all {savedCount} pages are clear and in order.</p>
      </Modal>
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wider text-ink-3">{label}</p>
      <p className="mt-1 font-semibold text-ink">{value}</p>
    </div>
  )
}

export type { MyExam }
