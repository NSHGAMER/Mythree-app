# design.md – Mythree design system

**Personality:** a traditional Sanskrit *gṛham* (home) rendered with modern SaaS polish. Warm, calm, respectful, motivating – never childish. Inspired by Duolingo's rhythm (clear path, small wins, streaks) but with heritage materials: cream paper, maroon cloth, temple gold, lamp-saffron.

## 1. Colour tokens
Defined once in `src/index.css` as CSS variables and exposed to Tailwind via `@theme inline`. Dark mode is class-based (`.dark` on `<html>`), chosen by the user (Light / Dark / System) and applied before first paint.

| Token | Light | Dark | Use |
|---|---|---|---|
| `bg` | `#FBF6EC` cream | `#15100D` | page background |
| `surface` / `surface-2` / `surface-3` | `#FFFDF8` / `#F5EBDA` / `#ECDCC2` | `#1F1712` / `#2A1F18` / `#372A20` | cards, wells, tracks |
| `line` / `line-strong` | `#E6D6BC` / `#D2B994` | `#3A2C22` / `#574333` | borders |
| `ink` / `ink-2` / `ink-3` | `#2E1D12` / `#5A4030` / `#85695A` | `#F6ECDD` / `#D8C4AB` / `#A68E76` | text hierarchy (brown family) |
| `maroon` (+`-hover`, `-soft`, `-ink`) | `#7A1F2B` | `#C2505E` | primary actions, active nav, brand |
| `gold` (+`-soft`, `-ink`) | `#C9962B` | `#E0B24C` | rewards, XP, highlights, focus ring |
| `saffron` (+`-soft`) | `#E8891D` | `#F29D3C` | streak flame, daily challenge |
| `brown` | `#5A3A22` | `#C79B72` | secondary accents |
| `success` / `danger` / `info` (+`-soft`) | `#2F7D4F` / `#B42318` / `#2F5D8A` | lighter equivalents | status |

Contrast: body text (`ink` on `bg`) > 12:1; `ink-3` on `bg` ≈ 4.9:1; maroon buttons with cream text ≈ 9:1.

Signature gradients: `maroon → gold → saffron` (progress rings, top borders, celebration), deep maroon hero `#7A1F2B → #3A0F14`, admin sidebar `#2A1210`.

## 2. Typography
| Role | Family | Notes |
|---|---|---|
| Display / headings | **Marcellus** | classical, inscriptional serif; `h1–h3`, numbers in stats |
| Sanskrit (Devanāgarī) | **Tiro Devanagari Sanskrit** | use `lang="sa"` + `.sanskrit` for every Sanskrit phrase |
| Body / UI | **Manrope Variable** | falls back to Tiro for inline Devanāgarī, Noto Sans Kannada for Kannada |
| Kannada | **Noto Sans Kannada 500** | organisation name |

Scale (mobile → desktop): Hero 42/60px · H1 28/36 · H2 24/28 · H3 20 · Body 15–17 · Small 13 · Micro labels 11–12 uppercase with 0.16–0.2em tracking.

## 3. Layout & spacing
- Containers: public `max-w-6xl`, member `max-w-6xl`, admin `max-w-[90rem]`; 16px gutters on mobile, 24px tablet+.
- 4px grid; cards use 20–32px padding; sections 64–80px vertical rhythm.
- Radius: inputs/buttons 12px, cards 20px (`--radius-card`), hero panels 28px, pills full.
- Shadows: `--shadow-soft` (resting), `--shadow-lift` (hover/dialog), `--shadow-glow` (gold emphasis).

## 4. Components (src/components/ui.tsx)
Button (primary maroon, gold, secondary, outline, ghost, danger · sm/md/lg · loading), Card, Input/Select/Textarea with label, hint & error, Toggle, Pill, ProgressBar (gradient, ARIA), ProgressRing (gradient SVG), Skeleton/SkeletonCards (shimmer), Spinner, EmptyState, Alert, Modal (bottom-sheet on mobile), Tabs, StatCard, PageHeader.
Brand: Logo, Wordmark (Mythree + संस्कृतगृहम्), OrnamentDivider (lotus).

## 5. Patterns
- **Learning path:** winding column of 80px circular “3-D” nodes (maroon = available, gold = complete, crown = 100%, grey + lock = locked) leading to a Final Exam crown node.
- **Quiz:** one question per screen, large tappable answer cards with letter keys and a pressed shadow, progress bar + question dots, local answer persistence, celebratory result with confetti, XP chip, new badges and full review.
- **Dashboard hero:** deep maroon card with gold progress ring, programme day, current chapter and primary CTA.
- **Gamification colour logic:** gold = XP/rewards, saffron = streak, maroon = learning, green = completion.
- **Admin:** dark maroon sidebar, dense but airy tables with sticky headers, sortable columns, pills for status, CSV export buttons top-right.
- **Navigation:** public top bar + slide-in drawer; member desktop sidebar + mobile bottom bar (5 items) ; GURU DAKSHINA always visible as a gold outlined item.

## 6. Motion
- Splash: logo springs in with rotating sun-ray halo and gold glow, wordmark and motto fade up, progress sweep (~2.3s, tap to skip, 0.5s with reduced motion).
- Page content fades/slides 12–24px; quiz questions slide horizontally; toasts spring from the bottom.
- Durations 150–600ms, ease-out; everything disabled under `prefers-reduced-motion`.

## 7. Imagery
Official logo (sun rays, lamp, open book, Om, Upaniṣad motto) – cropped circular for icons; promotional artwork “Namma Mane – Samskṛtagṛham” used in hero/about. Icons are lucide line icons at 1.5–2px stroke.

## 8. Accessibility
Visible gold focus ring, labels for all fields, `role="progressbar"`/`dialog`/`tablist`, `aria-live` for chat and toasts, min 44px targets, colour never the only signal (icons + text on statuses).
