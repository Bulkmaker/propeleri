# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start dev server (Turbopack)
npm run build    # Production build with TypeScript checking
npm run start    # Start production server
npm run test      # Run Playwright tests
npx playwright test --ui # Run tests with UI
npm run lint     # ESLint
```

## Architecture

Hockey team website for HC Propeleri Novi Sad. Next.js 16 App Router with Supabase backend, three-language support, and role-based admin panel.

### Stack
- **Next.js 16** (App Router) + React 19 + TypeScript 5 (strict)
- **Supabase** — PostgreSQL database, Auth (email/password), Storage (avatars, gallery, events)
- **next-intl** — i18n with locales `sr` (default), `ru`, `en`; prefix strategy `as-needed`
- **Tailwind CSS v4** + **shadcn/ui** — dark theme only, team colors (navy #1a2744, orange #e8732a)
- **lucide-react** — icons

### Routing & i18n
All pages live under `src/app/[locale]/`. The middleware (`src/middleware.ts`) handles both locale rewriting and Supabase session refresh. With `as-needed` prefix, Serbian URLs have no prefix (`/roster`), other locales are prefixed (`/ru/roster`, `/en/roster`).

Translations are in `src/messages/{sr,ru,en}.json`, organized by namespace. Use `useTranslations("namespace")` in components. Database content with multilingual fields uses `title`, `title_ru`, `title_en` columns.

### Supabase Access Pattern
- **Server components** — `await createClient()` from `@/lib/supabase/server` (uses cookies)
- **Client components** — `createClient()` from `@/lib/supabase/client` (browser client)
- **Middleware** — gracefully skips Supabase if not configured (placeholder detection)

Server components fetch data directly with `async/await`. Client components use `useEffect` + state.

### Auth & Permissions
Open registration with admin approval (`is_approved` flag). Two role dimensions:

- **`app_role`**: `admin` | `player` — controls system-level access
- **`team_role`**: `captain` | `assistant_captain` | `player` — controls team-level actions

Admin access = `app_role === "admin"` OR `team_role in ["captain", "assistant_captain"]`. Protected routes (`/profile`, `/admin/**`) enforced in middleware + admin layout server check.

### Database
Types in `src/types/database.ts`. Key tables: `profiles`, `seasons`, `games`, `game_lineups`, `game_stats`, `training_sessions`, `training_stats`, `tournaments`, `events`, `gallery_albums`, `gallery_photos`. Computed views: `player_game_totals`, `player_training_totals`, `player_season_stats`. SQL migration in `supabase/migrations/001_initial_schema.sql`.

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
- Language: respond to user in Russian; code comments and identifiers in English
