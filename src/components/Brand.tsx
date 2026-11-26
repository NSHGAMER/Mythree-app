import { Link } from 'react-router-dom'
import { cx } from './ui'

export function Logo({ size = 40, className, spin = false }: { size?: number; className?: string; spin?: boolean }) {
  return (
    <img
      src="/images/logo.webp"
      width={size}
      height={size}
      alt="Mythree logo"
      className={cx('shrink-0 rounded-full', spin && 'animate-spin-slow', className)}
      decoding="async"
    />
  )
}

export function Wordmark({ to = '/', compact = false, className }: { to?: string; compact?: boolean; className?: string }) {
  return (
    <Link to={to} className={cx('group flex items-center gap-2.5', className)} aria-label="Mythree home">
      <Logo size={compact ? 34 : 42} className="ring-2 ring-gold/30 transition group-hover:ring-gold/60" />
      <span className="flex flex-col leading-none">
        <span className="font-display text-xl tracking-wide text-maroon-ink">Mythree</span>
        {!compact && (
          <span className="sanskrit mt-0.5 text-[0.8rem] text-gold-ink" lang="sa">
            संस्कृतगृहम्
          </span>
        )}
      </span>
    </Link>
  )
}

/** Decorative lotus/mandala divider */
export function OrnamentDivider({ className }: { className?: string }) {
  return (
    <div className={cx('flex items-center justify-center gap-3 text-gold', className)} aria-hidden>
      <span className="h-px w-16 bg-gradient-to-r from-transparent to-gold/60" />
      <svg width="28" height="16" viewBox="0 0 28 16" fill="none">
        <path d="M14 1c2.5 3.5 2.5 8 0 14-2.5-6-2.5-10.5 0-14Z" fill="currentColor" opacity=".85" />
        <path d="M14 15C11 10 6.5 7.5 1 7.5c3 4.5 7.5 7.5 13 7.5Zm0 0c3-5 7.5-7.5 13-7.5-3 4.5-7.5 7.5-13 7.5Z" fill="currentColor" opacity=".55" />
      </svg>
      <span className="h-px w-16 bg-gradient-to-l from-transparent to-gold/60" />
    </div>
  )
}
