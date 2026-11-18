# Development guide

## Prerequisites

- Node.js ≥ 22 (see `.nvmrc`)
- pnpm ≥ 9 (`corepack enable` will pick up the version pinned in
  `package.json#packageManager`)
- Docker + Docker Compose (only needed for the containerized workflow, or
  to run a local Postgres without installing it natively)

## Install

```bash
pnpm install
```

On first install, pnpm will ask to approve build scripts for `prisma`,
`@prisma/client`, `@prisma/engines`, and `esbuild` — these are already
pre-approved via `pnpm.onlyBuiltDependencies` in the root `package.json`,
so a plain `pnpm install` is sufficient; no interactive approval needed.

## Environment variables

Copy the example env files and adjust as needed:

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
cp .env.example .env   # only needed for `docker compose`
```

- `apps/api/.env` — used by `pnpm dev:api` / `pnpm --filter @academy-library/api dev`.
- `apps/web/.env` — used by `pnpm dev:web` / Vite.
- root `.env` — only read by `compose.yaml` when running the full stack in
  Docker; local `pnpm dev` does not use it.

## Running locally (without Docker)

You need a running PostgreSQL instance reachable at the `DATABASE_URL` in
`apps/api/.env`. The easiest way is to start just the `postgres` service
from Compose and point the app at it:

```bash
docker compose up -d postgres
pnpm db:migrate        # applies/creates migrations against that database
pnpm dev               # runs both apps in parallel (web on :5173, api on :4000)
```

Or individually:

```bash
pnpm dev:api   # apps/api, with `tsx watch`
pnpm dev:web   # apps/web, Vite dev server
```

## Running the full stack with Docker Compose

```bash
cp .env.example .env   # first time only
docker compose up -d --build
```

This starts, in dependency order: `postgres` (with a healthcheck) →
`migrate` (a one-shot job that runs `prisma migrate deploy`, then exits 0)
→ `api` (waits for `migrate` to succeed) → `web` (waits for `api` to be
healthy). Default published ports: API on `4000`, web on `8080`, Postgres
on `5432` — override any of them via the root `.env` (`API_PORT`,
`WEB_PORT`, `POSTGRES_PORT`) if those are already taken on your machine.

```bash
curl http://localhost:4000/api/v1/health
curl http://localhost:4000/api/v1/ready
docker compose logs -f api
docker compose down          # stop and remove containers (keeps the postgres-data volume)
docker compose down -v       # also deletes the database volume
```

## Database migrations

Prisma owns the migration history under `apps/api/prisma/migrations/`.

**Locally** (creates a new migration from schema changes and applies it):

```bash
pnpm db:migrate
# or: pnpm --filter @academy-library/api db:migrate
```

**In Docker / production** (applies existing migrations only, never
generates new ones — this is what the `migrate` Compose service runs):

```bash
pnpm db:migrate:deploy
```

**Regenerating the Prisma client** after pulling schema changes someone
else made (normally run automatically by `db:migrate`, but needed
standalone after a fresh checkout before `pnpm dev:api` works):

```bash
pnpm db:generate
```

Inspect data with Prisma Studio:

```bash
pnpm db:studio
```

## Quality gates

```bash
pnpm format          # Prettier, writes changes
pnpm format:check    # Prettier, check only (used in CI)
pnpm lint            # ESLint across the whole repo
pnpm typecheck        # tsc --noEmit in every package/app
pnpm test             # Vitest in every package/app
pnpm build            # production build of contracts, api, web
```

All of the above (except `format`) are run in CI on every push/PR — see
`.github/workflows/ci.yaml`.

## Project structure

See [`docs/architecture/overview.md`](architecture/overview.md).
