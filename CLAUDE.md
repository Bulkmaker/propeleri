# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start dev server (Turbopack, port 3100)
npm run build    # Production build with TypeScript checking
npm run start    # Start production server
npm run lint     # ESLint (flat config, React Compiler rules)
npx playwright test        # Run Playwright e2e tests
npx playwright test --ui   # Run tests with interactive UI
```

## Architecture

Hockey team website for **HC Propeleri Novi Sad**. Next.js 16 App Router with Supabase backend, three-language support (sr/ru/en), and role-based admin panel.

### Stack
- **Next.js 16.1.6** (App Router) + **React 19** + **TypeScript 5** (strict) + React Compiler
- **Supabase** (`@supabase/supabase-js` ^2.95, `@supabase/ssr` ^0.8) — PostgreSQL, Auth (email/password), Storage (avatars, gallery, events)
- **next-intl** ^4.8 — i18n with locales `sr` (default), `ru`, `en`; prefix strategy `as-needed`
- **Tailwind CSS v4** + **shadcn/ui** (`radix-ui` ^1.4) — dark theme only, team colors (navy `#1a2744`, orange `#e8732a`)
- **lucide-react** — icons
- **Playwright** ^1.58 — e2e testing

### Project Structure
```
src/
├── app/[locale]/           # Pages (App Router)
│   ├── admin/              # Admin panel (client components)
│   │   ├── games/          # Game management + lineup editor
│   │   ├── tournaments/    # Tournament management
│   │   ├── training/       # Training session management
│   │   ├── events/         # Event management
│   │   ├── gallery/        # Photo gallery management
│   │   ├── roster/         # Player management
│   │   └── seasons/        # Season management
│   ├── games/              # Public game pages
│   ├── tournaments/        # Public tournament pages
│   ├── training/           # Public training pages
│   ├── roster/             # Public roster + player profiles
│   ├── schedule/           # Combined schedule view
│   ├── stats/              # Player statistics
│   ├── events/             # Team events
│   ├── gallery/            # Photo gallery
│   ├── login/              # Auth pages
│   ├── register/
│   └── profile/            # User profile (protected)
├── components/
│   ├── admin/              # Admin-specific components (GameForm, etc.)
│   ├── games/              # HockeyRink, GameLineupEditor (Rink/List views), UnifiedGameEditor
│   ├── matches/            # GameMatchCard, GameDetailView, TeamAvatar
│   ├── tournament/         # Tournament brackets, groups, standings
│   ├── training/           # Training session components
│   ├── roster/             # PlayerTable, player cards
│   ├── stats/              # Statistics tables
│   ├── schedule/           # Schedule views
│   ├── events/             # Event cards
│   ├── gallery/            # Gallery grids
│   ├── home/               # Landing page sections
│   ├── layout/             # Navbar, Footer, Navigation
│   ├── auth/               # Auth forms
│   ├── profile/            # Profile editor
│   ├── players/            # Player selection components
│   ├── shared/             # Shared/reusable components
│   └── ui/                 # shadcn/ui primitives
├── lib/
│   ├── supabase/           # server.ts, client.ts, proxy.ts
│   └── utils/
│       ├── constants.ts    # Position colors, role mappings
│       ├── country.ts      # Country flags (emoji from code)
│       ├── datetime.ts     # Date/time formatting helpers
│       ├── game-stats.ts   # Game statistics calculations
│       ├── match-slug.ts   # URL slug generation for matches
│       ├── player-name.ts  # Player name formatting
│       ├── tournament.ts   # Tournament helpers (standings, brackets)
│       └── training-match.ts # Training match data helpers
├── i18n/                   # next-intl config (routing, navigation, request)
├── messages/               # Translation files (sr.json, ru.json, en.json)
└── types/
    └── database.ts         # All TypeScript types for Supabase tables
```

### Routing & i18n
All pages live under `src/app/[locale]/`. The middleware (`src/proxy.ts`) handles both locale rewriting and Supabase session refresh. With `as-needed` prefix, Serbian URLs have no prefix (`/roster`), other locales are prefixed (`/ru/roster`, `/en/roster`).

Translations are in `src/messages/{sr,ru,en}.json`, organized by namespace. Use `useTranslations("namespace")` in components. Database content with multilingual fields uses `title`, `title_ru`, `title_en` columns.

### Supabase Access Pattern
- **Server components** — `await createClient()` from `@/lib/supabase/server` (uses cookies)
- **Client components** — `createClient()` from `@/lib/supabase/client` (browser client)
- **Middleware** — gracefully skips Supabase if not configured

Server components fetch data directly with `async/await`. Client components use `useEffect` + state.

### Auth & Permissions
Open registration with admin approval (`is_approved` flag). Two role dimensions:

- **`app_role`**: `admin` | `player` — controls system-level access
- **`team_role`**: `captain` | `assistant_captain` | `player` — controls team-level actions

Admin access = `app_role === "admin"` OR `team_role in ["captain", "assistant_captain"]`. Protected routes (`/profile`, `/admin/**`) enforced in middleware + admin layout server check.

### Database
Types in `src/types/database.ts`. Key tables:

| Table | Purpose |
|-------|---------|
| `profiles` | Player/user profiles (position, role, jersey, avatar, guest flag) |
| `teams` | All teams including Propeleri (`is_propeleri` flag) and opponents |
| `seasons` | Season definitions with `is_current` flag |
| `games` | Games linked to season, optional tournament, opponent team |
| `game_lineups` | Player positions per game (line number, slot position) |
| `game_stats` | Per-game player statistics (goals, assists, PIM, +/-) |
| `training_sessions` | Training sessions with optional match data (JSON) |
| `training_stats` | Per-training player attendance and stats |
| `tournaments` | Tournament definitions (cup/placement/round_robin/custom) |
| `tournament_teams` | Teams participating in tournament |
| `tournament_groups` | Groups within tournament |
| `tournament_matches` | Matches with bracket support (group + playoff stages) |
| `tournament_player_registrations` | Player registrations for tournaments |
| `events` | Team events (multilingual title/description) |
| `gallery_albums` | Photo albums linked to events |
| `gallery_photos` | Individual photos in albums |

Computed views: `player_game_totals`, `player_training_totals`, `player_season_stats`.

Game notes stored as JSON in `games.notes` column with `GameNotesPayload` type (goal events with periods/times, goalie report).

Training matches stored as JSON in `training_sessions.match_data` with `TrainingMatchData` type (team A/B scores, goalies, goal events).

13 migration files in `supabase/migrations/` (from initial schema through RLS, tournament sync, teams/opponents merge).

Supabase returns untyped data — use `as TypeName` casts when indexing typed Records (e.g., `POSITION_COLORS[player.position as PlayerPosition]`).

### Styling
Dark theme defined as CSS variables in `src/app/globals.css`. No light theme. Custom utilities: `.hero-gradient`, `.orange-glow`, `.card-hover`. shadcn/ui components in `src/components/ui/`. Use `cn()` from `@/lib/utils` for class merging.

## Key Conventions

- Import alias: `@/*` → `src/*`
- Server components by default; add `"use client"` only when needed (state, effects, browser APIs)
- i18n navigation: use `Link` from `@/i18n/navigation`, not from `next/link`
- All admin pages are client components (use browser Supabase client)
- Public pages are server components (use server Supabase client)
- Color/position mappings in `src/lib/utils/constants.ts` require type casts from Supabase data
- Env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- React Compiler: avoid `setState` directly in `useEffect` body — use `setTimeout(0)` wrapper for data-loading effects
- ESLint: `catch (err: unknown)` with `err instanceof Error` — never use `catch (err: any)`
- Generic payloads typed as `Record<string, unknown>` — avoid `any`
- External images use `<img>` with `eslint-disable @next/next/no-img-element` (can't use `next/image` for arbitrary URLs)
- Language: respond to user in Russian; code comments and identifiers in English
