# HC Propeleri Novi Sad

Hockey team website for HC Propeleri Novi Sad — a full-featured team management platform with public-facing pages and an admin panel.

## Features

- **Roster** — player profiles with positions, stats, avatars
- **Games** — game management with lineups (Rink & All Lines views), mobile-friendly editor, and detailed game notes (goals, assists, goalie reports)
- **Tournaments** — cup/placement/round-robin formats with group stages, playoff brackets, and standings
- **Training** — training session tracking with attendance, intra-squad match scoring
- **Statistics** — per-season player stats aggregated from games and training
- **Schedule** — combined view of upcoming games and training sessions
- **Events** — team events with multilingual content
- **Gallery** — photo albums linked to events
- **Admin Panel** — role-based access for team management (captains, assistant captains, admins)
- **i18n** — three languages: Serbian (default), Russian, English

## Tech Stack

- [Next.js 16](https://nextjs.org/) (App Router) + React 19 + TypeScript
- [Supabase](https://supabase.com/) — PostgreSQL, Auth, Storage
- [next-intl](https://next-intl.dev/) — internationalization
- [Tailwind CSS v4](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/) — dark theme
- [Playwright](https://playwright.dev/) — e2e testing

## Getting Started

### Prerequisites

- Node.js 18+
- Supabase project (or local Supabase instance)

### Environment Variables

Create a `.env.local` file:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### Install & Run

```bash
npm install
npm run dev       # Start dev server on port 3100
```

Open [http://localhost:3100](http://localhost:3100) to see the app.

### Other Commands

```bash
npm run build     # Production build
npm run start     # Start production server
npm run lint      # ESLint
npx playwright test        # Run e2e tests
npx playwright test --ui   # Tests with interactive UI
```

## Database

The app uses Supabase PostgreSQL. Migration files are in `supabase/migrations/`. Key tables include `profiles`, `teams`, `seasons`, `games`, `game_lineups`, `game_stats`, `training_sessions`, `tournaments`, `tournament_matches`, `events`, `gallery_albums`, and more.

TypeScript types for all tables are defined in `src/types/database.ts`.

## Project Structure

```
src/
├── app/[locale]/     # Pages (12 route groups + admin panel)
├── components/       # 17 component directories (ui, games, matches, etc.)
├── lib/              # Supabase clients + utility functions
├── i18n/             # next-intl configuration
├── messages/         # Translation files (sr, ru, en)
└── types/            # TypeScript type definitions
```

## Deployment

Deploy on [Vercel](https://vercel.com/) with environment variables configured. The app uses `as-needed` locale prefix strategy — Serbian URLs have no prefix, other languages are prefixed (`/ru/...`, `/en/...`).
