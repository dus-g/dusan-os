# DUSAN OS

A personal life operating system: work, pay, tax, money, budget, savings, university, medicine,
missions, XP, habits, health, journal and a ten-year roadmap — in one fast, dark, mobile-first app.

Built with Next.js 15 (App Router, Server Actions) · TypeScript · Prisma · Neon Postgres · Auth.js v5 ·
Tailwind v4 + shadcn-style UI · Recharts · Framer Motion · PostHog. Deploys to Vercel.

---

## Daily use (under 5 minutes)

| When | Where | What |
|---|---|---|
| After a shift | **Shifts** | Date, start, finish, break. Hours, overtime, penalty rates, tax, super and take-home are calculated. Sundays are detected automatically. |
| Evening | **Habits** | Tick today's boxes. |
| Evening | **Health** | Weight / sleep / water / steps / gym — blank fields are skipped. |
| Evening | **Journal** | Four questions. |
| When you spend | **Expenses** | Amount + category. It comes out of the chosen account. |
| Thursday | **Payday** | Record the pay; unpaid shifts are linked, and you can split straight into savings. |
| Sunday | **Journal → Weekly review** | Look back, set next week's goal. |

Everything else (dashboard, budget, goals, missions, achievements, analytics) updates itself.

---

## Project structure

```
dusan-os/
├── prisma/
│   ├── schema.prisma          # 29 models — money in integer cents, dates as @db.Date
│   └── seed.ts                # creates Dusan's account with every default
├── src/
│   ├── auth.ts / auth.config.ts   # Auth.js v5: credentials + JWT (90-day sessions); edge-safe split
│   ├── middleware.ts              # route protection
│   ├── actions/               # Server Actions (all mutations)
│   │   ├── auth.ts            # login, register, reset, profile, password, delete account
│   │   ├── work.ts            # shifts, pay profiles
│   │   ├── finance.ts         # paydays, accounts, transfers, expenses, categories, budgets, goals
│   │   ├── education.ts       # programs, semesters, subjects, assessments, GAMSAT, applications
│   │   └── life.ts            # missions, habits, health, journal, roadmap, preferences
│   ├── app/
│   │   ├── (auth)/            # login, register, forgot-password, reset-password
│   │   ├── (app)/             # dashboard, work, work/rates, payday, forecast, finances, expenses,
│   │   │                      # budget, savings, university, medicine, missions, rpg, habits,
│   │   │                      # health, journal, roadmap, analytics, settings, menu (mobile)
│   │   └── api/               # auth handler, /api/health, /api/export (full JSON backup)
│   ├── components/            # UI primitives, charts, LifeArc timeline, nav, forms
│   └── lib/
│       ├── pay.ts             # shift pay engine (ordinary / OT tier 1 / OT tier 2 / Sunday / PH)
│       ├── tax.ts             # ATO resident tax, LITO, Medicare levy, HELP repayments
│       ├── ledger.ts          # every balance change is a Transaction → net-worth history
│       ├── progress.ts        # XP ledger, auto-tracked missions, achievement unlocks
│       ├── stats.ts           # lifetime stats used everywhere
│       ├── bootstrap.ts       # defaults for a new account (rates, budget, goals, missions…)
│       └── dates.ts           # Adelaide-aware "today", week/month/FY helpers
└── .env.example
```

### Design decisions worth knowing

* **Money is stored as integer cents.** No floating-point drift over ten years.
* **Pay is snapshotted onto each shift.** Changing your rate later never rewrites history.
* **Tax is estimated per pay week** (PAYG is withheld on the week's total) and apportioned to shifts.
  Uses 2025–26 resident rates, LITO, Medicare levy, and optional HELP repayments. Switch to a flat % in Settings.
* **Super** is calculated at 12% of ordinary-time earnings (overtime excluded, per the SG rules).
* **Overtime** starts after 7.6 h in a day; the first 3 OT hours are tier 1. Both are editable per pay profile.
* **Balances only change through transactions**, so net-worth charts can be rebuilt for any date.
* **XP is an append-only ledger.** Deleting a shift/habit/journal entry removes exactly the XP it earned.
  Level L needs 50·L·(L−1) XP (L10 = 4,500, L20 = 19,000, L50 = 122,500).
* **Missions can auto-track** savings, hours, shift count, days employed or uni start, and complete themselves.
* **Degrees:** Flinders topics are 4.5 units; 36 units per full-time year (BPH 108, MD 144 — editable).
  HECS estimates use your recorded annual CSP cost × units enrolled.

---

## Local setup

Requirements: Node 20+, a Postgres database (a free Neon project is easiest).

```bash
cp .env.example .env          # fill in DATABASE_URL, DIRECT_URL, AUTH_SECRET
npm install                   # also runs `prisma generate`
npx prisma migrate dev --name init   # creates tables (or: npm run db:push)
npm run db:seed               # creates your account with all defaults
npm run dev                   # http://localhost:3000
```

Generate `AUTH_SECRET` with `npx auth secret` or `openssl rand -base64 32`.

You can also skip the seed and just use **Register** — every new account gets the same defaults.

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | ✅ | Neon **pooled** connection string (`…-pooler…?sslmode=require`) |
| `DIRECT_URL` | ✅ | Neon **direct** connection string (used for migrations) |
| `AUTH_SECRET` | ✅ | Signs session JWTs |
| `AUTH_TRUST_HOST` | ✅ on Vercel | `true` |
| `APP_URL` | ✅ | Public URL, used in password-reset emails |
| `RESEND_API_KEY` | optional | Sends reset emails via Resend. Without it, reset links are printed to the server log. |
| `EMAIL_FROM` | optional | e.g. `DUSAN OS <noreply@yourdomain.com>` |
| `NEXT_PUBLIC_POSTHOG_KEY` | optional | Product analytics (proxied through `/ingest` to avoid ad-blockers) |
| `NEXT_PUBLIC_POSTHOG_HOST` | optional | `https://us.i.posthog.com` or `https://eu.i.posthog.com` |
| `SEED_EMAIL` / `SEED_PASSWORD` | seed only | Account created by `npm run db:seed` |
| `SEED_SAMPLE` | seed only | `1` adds six weeks of example shifts |

---

## Deploying (Neon + Vercel)

1. **Neon** — create a project in the Sydney region (`aws-ap-southeast-2`) for the lowest latency from Adelaide.
   Copy both the *pooled* and *direct* connection strings.
2. **Create the tables** from your machine, pointing `.env` at Neon:
   ```bash
   npx prisma migrate dev --name init    # first time; commit prisma/migrations
   npm run db:seed
   ```
3. **Vercel** — import the Git repo. Framework preset: Next.js. Set the region to Sydney (`syd1`).
   Add every required env var above (Production + Preview).
4. **Build command:** keep the default (`npm run build` runs `prisma generate && next build`).
   To apply future migrations automatically, change it to `prisma migrate deploy && npm run build`.
5. Visit your domain and sign in. On your phone use *Share → Add to Home Screen* — the app ships a web manifest
   and behaves like a native app.

### Changing the schema later

```bash
# edit prisma/schema.prisma
npx prisma migrate dev --name describe_change
git commit -am "…" && git push      # Vercel runs migrate deploy if you set it up in step 4
```

---

## Backups — this app holds a decade of your life

* **Neon** keeps point-in-time history (7 days on the free plan, longer on paid). Consider a paid plan once the data matters.
* **Settings → Download full export** produces a complete JSON file. Do it every few months and store it off-site.
* For belt-and-braces: `pg_dump "$DIRECT_URL" > dusan-os-$(date +%F).sql`.

## Keeping numbers accurate

* **Tax brackets** live in `src/lib/tax.ts` (`TAX_YEAR`). Update them each July when the ATO publishes new rates.
* **Pay rates**: when the award or your employer changes rates, add a new pay profile (or edit the default) in
  **Shifts → Pay profiles**. Old shifts keep the rate they were paid at.
* **Uni costs**: edit annual CSP amounts on the University and Medicine pages; they change most years.
* Tax, super and HECS figures are **estimates** for planning. Your payslips and ATO notices are the source of truth —
  use Payday to record what actually landed in your account.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server (Turbopack) |
| `npm run build` / `start` | Production build / serve |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:migrate` | Create & apply a migration locally |
| `npm run db:deploy` | Apply migrations (production) |
| `npm run db:push` | Sync schema without migrations (prototyping) |
| `npm run db:seed` | Seed the default account |
| `npm run db:studio` | Browse the database |
