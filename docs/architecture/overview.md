# Architecture overview

Academy Library is a pnpm-workspace monorepo with two deployable
applications and two shared packages.

```text
academy-library/
├── apps/
│   ├── web/            React + Vite SPA (feature-based structure)
│   └── api/             Express + Prisma modular-monolith backend
├── packages/
│   ├── contracts/       Shared Zod schemas and inferred types
│   └── config/          Shared TypeScript compiler configuration
├── infra/
│   └── docker/          Nginx config for the web image, Postgres init dir
├── docs/                This documentation
├── compose.yaml          Local/production-shaped multi-container stack
└── pnpm-workspace.yaml
```

## apps/web

A standalone Vite + React + TypeScript SPA. It does not use React Router's
"framework mode" (the Vite plugin that generates routes from the filesystem)
— routing is configured explicitly via `createBrowserRouter` in **data
mode**, giving full control while keeping Vite's plain build pipeline.

- `src/app/` — application shell: router config (`routes.tsx`/`router.tsx`),
  the TanStack Query client, the top-level error boundary, the root
  layout, and theming (`src/app/theme/`).
- `src/features/<feature>/` — one directory per user-facing feature (today:
  `home`, `not-found`, and the dev-only `dev-design-system` showcase).
  Each feature owns its component(s), CSS Module(s), and tests. Business
  features (search, collections, bookmarks, etc.) will land here in later
  tasks.
- `src/shared/ui/` — the reusable design-system component library
  (Button, Input, Modal, Dropdown, Toast, …) and `src/shared/hooks/` for
  the interaction logic behind it (portals, focus trap, outside-click,
  escape, scroll lock, focus restoration). See
  [`docs/design-system/README.md`](../design-system/README.md) for the
  full catalog, token architecture, and theming model.
- `src/styles/` — global CSS and design tokens (native CSS variables),
  loaded once from `main.tsx`.
- Route-level code splitting is done via React Router's `lazy` route
  property, not manual `React.lazy` — see `src/app/routes.tsx`.

## apps/api

A modular-monolith Express service: all business logic lives in one
deployable process, organized by technical concern rather than split into
microservices. As real business domains (resources, courses, bookmarks,
...) are added in later tasks, they should get their own directory under
`src/` (e.g. `src/modules/resources/`) rather than being scattered across
the current `routes/`/`middleware/` split, which exists only to support the
infrastructure endpoints built in this task.

- `src/app.ts` — builds and configures the Express `app` (middleware,
  routes) but does not start a server. Kept separate from `server.ts` so
  the app can be imported directly into tests (via Supertest) without
  binding a real port.
- `src/server.ts` — the process entry point: starts the HTTP server and
  owns graceful shutdown.
- `src/config/env.ts` — validates `process.env` against a Zod schema at
  startup and exits fast on misconfiguration, instead of failing later with
  confusing runtime errors.
- `src/lib/` — infrastructure singletons (Pino logger, Prisma client).
- `src/routes/`, `src/middleware/`, `src/errors/` — the health/readiness
  endpoints and the shared error-handling pipeline built in this task.
- `prisma/` — the Prisma schema and migration history (see
  [`docs/development.md`](../development.md) for how to run migrations).

## packages/contracts

Zod schemas (and their inferred TypeScript types) shared between `web` and
`api`, so the two apps cannot silently drift on request/response shapes.
Today it only contains infrastructure contracts (health/ready responses, the
API error envelope); business contracts (resource, course, bookmark, ...)
belong here once those domains exist.

## packages/config

Shared `tsconfig` bases (`tsconfig.base.json`, `tsconfig.node.json`) that
every other package/app extends, so compiler strictness stays consistent
project-wide. ESLint and Prettier are configured once at the repo root
instead (see `eslint.config.mjs`), since linting the whole repository from
one place is simpler than per-package configs at this scale.

## Request flow (today)

```text
Browser ──▶ apps/web (Vite dev server / Nginx)
                 │
                 ▼  (not yet wired to any UI — infra only)
apps/api  /api/v1/health   → liveness, no dependencies checked
          /api/v1/ready    → liveness + a live `SELECT 1` against Postgres
                 │
                 ▼
            PostgreSQL (via Prisma)
```

No business screens or endpoints exist yet — this task only establishes the
plumbing (routing, error handling, logging, DB connectivity, Docker,
CI) that later tasks build on.
