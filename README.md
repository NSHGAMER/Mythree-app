# Mythree – संस्कृतगृहम्

A premium, installable Sanskrit learning and member-management platform for Maitrī Samskṛta-Samskṛti Pratiṣṭhāna (R), Bengaluru.

Members read the printed textbook at home and use Mythree for chapter tests, daily & weekly challenges, streaks, XP, badges and leaderboards. When every chapter is complete they declare readiness and the final exam paper is posted to them. Guru Dakshina is a voluntary contribution via Razorpay.

## Documentation
| File | Contents |
|---|---|
| [PRO.md](PRO.md) | Requirements |
| [architecture.md](architecture.md) | Architecture, data model, flows, scaling |
| [design.md](design.md) | Design system |
| [rules.md](rules.md) | Engineering & security rules |
| [phases.md](phases.md) | Delivery status and pending configuration |
| [memory.md](memory.md) | Working memory / progress log |

## Quick start
```bash
npm install
cp .env.example .env.local   # fill VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY
npm run dev
```

## Scripts
| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | Type-check + production build (PWA included) |
| `npm test` | Unit & component tests (Vitest) |
| `npm run test:e2e` | Playwright responsive & PWA checks (needs a built preview) |
| `npm run icons` | Regenerate icons/images from `/brand` |
| `npm run loadtest` | Load test against a configured Supabase project (see `loadtest/README.md`) |

## Backend
Database schema, RLS policies and business logic are in `supabase/migrations`. Edge Functions (payments, OTP, notifications, account deletion) are in `supabase/functions`. See `.env.example` for every secret and where it lives.

## First admin
Add your email to the allowlist **before** registering:
```sql
insert into public.admin_allowlist (email) values ('you@example.org');
```
or promote an existing member:
```sql
update public.profiles set role = 'admin' where email = 'you@example.org';
```
