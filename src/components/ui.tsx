import { clsx } from 'clsx'
import {
  forwardRef,
  useEffect,
  useId,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import { createPortal } from 'react-dom'
import { Link, type LinkProps } from 'react-router-dom'
import { Loader2, X } from 'lucide-react'

export const cx = clsx

// ---------------------------------------------------------------- Button
type Variant = 'primary' | 'gold' | 'secondary' | 'ghost' | 'danger' | 'outline'
type Size = 'sm' | 'md' | 'lg'

const variants: Record<Variant, string> = {
  primary:
    'bg-maroon text-on-primary hover:bg-maroon-hover shadow-[0_6px_20px_-6px_rgb(122_31_43/0.55)] active:translate-y-px',
  gold: 'bg-gradient-to-b from-[#e3b54f] to-gold text-[#2e1d12] hover:brightness-105 shadow-[0_6px_20px_-8px_rgb(201_150_43/0.8)] active:translate-y-px',
  secondary: 'bg-surface-2 text-ink hover:bg-surface-3 border border-line',
  outline: 'border border-line-strong text-ink hover:bg-surface-2',
  ghost: 'text-ink-2 hover:bg-surface-2 hover:text-ink',
  danger: 'bg-danger text-white hover:brightness-110',
}
const sizes: Record<Size, string> = {
  sm: 'h-9 px-3.5 text-sm gap-1.5 rounded-xl',
  md: 'h-11 px-5 text-[0.95rem] gap-2 rounded-xl',
  lg: 'h-13 px-7 text-base gap-2.5 rounded-2xl',
}

export function buttonClass(variant: Variant = 'primary', size: Size = 'md', extra?: string) {
  return cx(
    'inline-flex select-none items-center justify-center font-semibold transition-all duration-200 disabled:pointer-events-none disabled:opacity-55 whitespace-nowrap',
    variants[variant],
    sizes[size],
    extra,
  )
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  icon?: ReactNode
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, icon, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button ref={ref} type={type} className={buttonClass(variant, size, className)} disabled={disabled || loading} aria-busy={loading} {...rest}>
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  )
})

export function ButtonLink({ variant = 'primary', size = 'md', className, ...rest }: LinkProps & { variant?: Variant; size?: Size }) {
  return <Link className={buttonClass(variant, size, className)} {...rest} />
}

// ---------------------------------------------------------------- Card
export function Card({ className, children, as: As = 'div', ...rest }: { className?: string; children: ReactNode; as?: 'div' | 'section' | 'article' } & Record<string, unknown>) {
  return (
    <As className={cx('card', className)} {...rest}>
      {children}
    </As>
  )
}

export function SectionTitle({ eyebrow, title, subtitle, action, className }: { eyebrow?: string; title: ReactNode; subtitle?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cx('flex flex-wrap items-end justify-between gap-3', className)}>
      <div>
        {eyebrow && <p className="mb-1 text-xs font-bold uppercase tracking-[0.18em] text-gold-ink">{eyebrow}</p>}
        <h2 className="text-2xl text-ink sm:text-[1.7rem]">{title}</h2>
        {subtitle && <p className="mt-1 max-w-2xl text-sm text-ink-3">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

// ---------------------------------------------------------------- Form fields
interface FieldShellProps {
  label: string
  error?: string
  hint?: ReactNode
  id: string
  required?: boolean
  children: ReactNode
  className?: string
}
function FieldShell({ label, error, hint, id, required, children, className }: FieldShellProps) {
  return (
    <div className={cx('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-sm font-semibold text-ink-2">
        {label}
        {required && <span className="ml-0.5 text-maroon" aria-hidden>*</span>}
      </label>
      {children}
      {error ? (
        <p id={`${id}-err`} role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-ink-3">{hint}</p>
      ) : null}
    </div>
  )
}

const inputBase =
  'w-full rounded-xl border bg-bg-elevated px-3.5 text-[0.95rem] text-ink placeholder:text-ink-3/70 transition focus:outline-none focus:ring-4 focus:ring-gold/20 disabled:opacity-60'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
  hint?: ReactNode
  wrapperClass?: string
  trailing?: ReactNode
}
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, hint, wrapperClass, className, id, required, trailing, ...rest },
  ref,
) {
  const auto = useId()
  const fid = id ?? auto
  return (
    <FieldShell label={label} error={error} hint={hint} id={fid} required={required} className={wrapperClass}>
      <div className="relative">
        <input
          ref={ref}
          id={fid}
          required={required}
          aria-invalid={!!error}
          aria-describedby={error ? `${fid}-err` : undefined}
          className={cx(inputBase, 'h-12', error ? 'border-danger' : 'border-line focus:border-gold', trailing && 'pr-12', className)}
          {...rest}
        />
        {trailing && <div className="absolute inset-y-0 right-1.5 flex items-center">{trailing}</div>}
      </div>
    </FieldShell>
  )
})

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string
  error?: string
  hint?: ReactNode
  wrapperClass?: string
  options: { value: string; label: string }[]
  placeholder?: string
}
export function Select({ label, error, hint, wrapperClass, className, id, options, placeholder, required, ...rest }: SelectProps) {
  const auto = useId()
  const fid = id ?? auto
  return (
    <FieldShell label={label} error={error} hint={hint} id={fid} required={required} className={wrapperClass}>
      <select
        id={fid}
        required={required}
        aria-invalid={!!error}
        className={cx(inputBase, 'h-12 appearance-none bg-[length:1rem] bg-[right_0.9rem_center] bg-no-repeat pr-10', error ? 'border-danger' : 'border-line focus:border-gold', className)}
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2385695a' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
        }}
        {...rest}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </FieldShell>
  )
}

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string
  error?: string
  hint?: ReactNode
  wrapperClass?: string
}
export function Textarea({ label, error, hint, wrapperClass, className, id, required, ...rest }: TextareaProps) {
  const auto = useId()
  const fid = id ?? auto
  return (
    <FieldShell label={label} error={error} hint={hint} id={fid} required={required} className={wrapperClass}>
      <textarea
        id={fid}
        required={required}
        aria-invalid={!!error}
        className={cx(inputBase, 'min-h-28 py-3', error ? 'border-danger' : 'border-line focus:border-gold', className)}
        {...rest}
      />
    </FieldShell>
  )
}

export function Toggle({ checked, onChange, label, description, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string; disabled?: boolean }) {
  const id = useId()
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <label htmlFor={id} className="text-sm font-semibold text-ink">
          {label}
        </label>
        {description && <p className="text-xs text-ink-3">{description}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cx(
          'relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50',
          checked ? 'bg-maroon' : 'bg-surface-3',
        )}
      >
        <span className={cx('absolute top-1 size-5 rounded-full bg-white shadow transition-all', checked ? 'left-6' : 'left-1')} />
      </button>
    </div>
  )
}

// ---------------------------------------------------------------- Feedback
export function Pill({ tone = 'neutral', children, className }: { tone?: 'neutral' | 'maroon' | 'gold' | 'success' | 'danger' | 'info' | 'saffron'; children: ReactNode; className?: string }) {
  const tones = {
    neutral: 'bg-surface-2 text-ink-2 border-line',
    maroon: 'bg-maroon-soft text-maroon-ink border-transparent',
    gold: 'bg-gold-soft text-gold-ink border-transparent',
    success: 'bg-success-soft text-success border-transparent',
    danger: 'bg-danger-soft text-danger border-transparent',
    info: 'bg-info-soft text-info border-transparent',
    saffron: 'bg-saffron-soft text-saffron border-transparent',
  }
  return (
    <span className={cx('inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold', tones[tone], className)}>
      {children}
    </span>
  )
}

export function ProgressBar({ value, className, tone = 'maroon', label, size = 'md' }: { value: number; className?: string; tone?: 'maroon' | 'gold' | 'success'; label?: string; size?: 'sm' | 'md' | 'lg' }) {
  const pct = Math.max(0, Math.min(100, value))
  const tones = {
    maroon: 'from-maroon to-[#b4424f]',
    gold: 'from-gold to-saffron',
    success: 'from-success to-[#4fa772]',
  }
  const h = { sm: 'h-1.5', md: 'h-2.5', lg: 'h-3.5' }[size]
  return (
    <div className={cx('w-full overflow-hidden rounded-full bg-surface-3', h, className)} role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div className={cx('h-full rounded-full bg-gradient-to-r transition-[width] duration-700 ease-out', tones[tone])} style={{ width: `${pct}%` }} />
    </div>
  )
}

export function ProgressRing({ value, size = 120, stroke = 10, children, tone = 'maroon' }: { value: number; size?: number; stroke?: number; children?: ReactNode; tone?: 'maroon' | 'gold' }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const pct = Math.max(0, Math.min(100, value))
  const gid = useId()
  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            {tone === 'maroon' ? (
              <>
                <stop offset="0%" stopColor="var(--maroon)" />
                <stop offset="100%" stopColor="var(--gold)" />
              </>
            ) : (
              <>
                <stop offset="0%" stopColor="var(--gold)" />
                <stop offset="100%" stopColor="var(--saffron)" />
              </>
            )}
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#${gid})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (pct / 100) * c}
          style={{ transition: 'stroke-dashoffset 1s ease-out' }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('skeleton', className)} aria-hidden />
}

export function SkeletonCards({ count = 3, className }: { count?: number; className?: string }) {
  return (
    <div className={cx('grid gap-4', className)} aria-busy="true" aria-label="Loading">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card space-y-3 p-5">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-7 w-2/3" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-5/6" />
        </div>
      ))}
    </div>
  )
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cx('size-5 animate-spin text-maroon', className)} aria-label="Loading" />
}

export function EmptyState({ icon, title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-line-strong px-6 py-12 text-center">
      {icon && <div className="grid size-14 place-items-center rounded-2xl bg-gold-soft text-gold-ink">{icon}</div>}
      <h3 className="text-lg text-ink">{title}</h3>
      {children && <div className="max-w-md text-sm text-ink-3">{children}</div>}
      {action}
    </div>
  )
}

export function Alert({ tone = 'info', title, children, icon, className }: { tone?: 'info' | 'success' | 'danger' | 'gold'; title?: string; children?: ReactNode; icon?: ReactNode; className?: string }) {
  const tones = {
    info: 'bg-info-soft text-info border-info/20',
    success: 'bg-success-soft text-success border-success/20',
    danger: 'bg-danger-soft text-danger border-danger/20',
    gold: 'bg-gold-soft text-gold-ink border-gold/30',
  }
  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} className={cx('flex gap-3 rounded-xl border px-4 py-3 text-sm', tones[tone], className)}>
      {icon && <div className="mt-0.5 shrink-0">{icon}</div>}
      <div>
        {title && <p className="font-bold">{title}</p>}
        {children && <div className="opacity-90">{children}</div>}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- Modal
export function Modal({ open, onClose, title, children, footer, size = 'md' }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; size?: 'sm' | 'md' | 'lg' }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])
  if (!open) return null
  const w = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-3xl' }[size]
  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-[#1a0f0c]/55 backdrop-blur-sm" onClick={onClose} />
      <div className={cx('relative max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl border border-line bg-surface p-6 shadow-[var(--shadow-lift)] sm:rounded-3xl', w)}>
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 className="text-xl text-ink">{title}</h2>
          <button onClick={onClose} className="-m-1 rounded-lg p-1 text-ink-3 hover:bg-surface-2" aria-label="Close">
            <X className="size-5" />
          </button>
        </div>
        {children}
        {footer && <div className="mt-6 flex flex-wrap justify-end gap-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}

// ---------------------------------------------------------------- Tabs
export function Tabs<T extends string>({ value, onChange, items, className }: { value: T; onChange: (v: T) => void; items: { value: T; label: ReactNode }[]; className?: string }) {
  return (
    <div role="tablist" className={cx('inline-flex rounded-xl border border-line bg-surface-2 p-1', className)}>
      {items.map((it) => (
        <button
          key={it.value}
          role="tab"
          aria-selected={value === it.value}
          onClick={() => onChange(it.value)}
          className={cx(
            'rounded-lg px-4 py-1.5 text-sm font-semibold transition',
            value === it.value ? 'bg-surface text-maroon-ink shadow-sm' : 'text-ink-3 hover:text-ink',
          )}
        >
          {it.label}
        </button>
      ))}
    </div>
  )
}

export function StatCard({ icon, label, value, sub, tone = 'maroon' }: { icon: ReactNode; label: string; value: ReactNode; sub?: ReactNode; tone?: 'maroon' | 'gold' | 'saffron' | 'success' | 'info' }) {
  const tones = {
    maroon: 'bg-maroon-soft text-maroon-ink',
    gold: 'bg-gold-soft text-gold-ink',
    saffron: 'bg-saffron-soft text-saffron',
    success: 'bg-success-soft text-success',
    info: 'bg-info-soft text-info',
  }
  return (
    <div className="card flex items-start gap-3 p-4 sm:p-5">
      <div className={cx('grid size-11 shrink-0 place-items-center rounded-xl', tones[tone])}>{icon}</div>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wider text-ink-3">{label}</p>
        <p className="mt-0.5 truncate font-display text-2xl text-ink">{value}</p>
        {sub && <p className="mt-0.5 text-xs text-ink-3">{sub}</p>}
      </div>
    </div>
  )
}

export function PageHeader({ title, subtitle, actions, sanskrit }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; sanskrit?: string }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        {sanskrit && <p className="sanskrit mb-0.5 text-sm text-gold-ink" lang="sa">{sanskrit}</p>}
        <h1 className="text-[1.75rem] leading-tight text-ink sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-sm text-ink-3">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}
