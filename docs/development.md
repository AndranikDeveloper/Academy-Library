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
  Generate a real value for `CSRF_SECRET` (the server refuses to start
  without one — see [`docs/architecture/authentication.md`](architecture/authentication.md)):
  ```bash
  openssl rand -hex 32
  ```
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

## Development accounts (seeding)

```bash
pnpm db:seed
```

Creates one account per role — `student@academy.test` / `lecturer@academy.test`
/ `admin@academy.test`, all with the password `DevPassword123!` unless
overridden (`SEED_STUDENT_PASSWORD`, etc. — see `apps/api/.env.example`).
Idempotent (safe to run repeatedly) and refuses to run with
`NODE_ENV=production`. See
[`docs/architecture/authentication.md`](architecture/authentication.md)
("Development accounts") for why this is the only way to get a
`LECTURER`/`ADMIN` account — `POST /api/v1/auth/register` can only ever
create a `STUDENT`.

As of Task 05B, the same script also seeds two `Group`s with memberships
across the three accounts, five `Course`s, and twelve `Resource`s
covering every resource type, difficulty, and visibility — see
[`docs/domain/resources.md`](domain/resources.md) ("Development seed")
for exactly what gets created and why it's safe to re-run.

As of Task 05C.1, these three accounts can sign in through the real
`/login` page (`pnpm --filter @academy-library/web dev`, then visit
`http://localhost:5173/login`) — `admin@academy.test` lands in a real
`ADMIN` session and can reach `/admin/*`; `student@academy.test`
cannot, and sees `RequireRole`'s 403 message if it tries.

## Running the test suite

```bash
pnpm test
```

`apps/api`'s integration tests (`tests/auth.routes.test.ts`,
`tests/resources.routes.test.ts`, and friends) run against a **real**
PostgreSQL database, not a mock — session expiry/revocation, the
case-insensitive email constraint, and real full-text search/
authorization queries are exactly the kind of behavior a mocked Prisma
client can't exercise honestly (see
[`docs/architecture/authentication.md`](architecture/authentication.md),
"Database schema", and [`docs/domain/resources.md`](domain/resources.md),
"Database schema"). Every test file that touches these tables resets
them in its own `beforeEach` and the whole suite runs with
`fileParallelism: false` (`apps/api/vitest.config.ts`) specifically so
that multiple such files can safely share this one database without
racing each other. This needs a separate database from your regular
dev one, created once:

```bash
docker compose up -d postgres   # if not already running
docker exec -it $(docker compose ps -q postgres) \
  psql -U academy -d academy_library -c "CREATE DATABASE academy_library_test OWNER academy;"
DATABASE_URL="postgresql://academy:academy@localhost:5433/academy_library_test?schema=public" \
  pnpm --filter @academy-library/api db:migrate:deploy
```

(Adjust the port/user/password above if your root `.env` overrides
`POSTGRES_PORT`/`POSTGRES_USER`/`POSTGRES_PASSWORD` — `apps/api/vitest.config.ts`
hardcodes the test `DATABASE_URL` it expects, so match that exactly.)
CI provisions the same database via a Postgres service container
(`.github/workflows/ci.yaml`) — no manual setup needed there.

`apps/web`'s tests (Task 05C.1 onward) mock the network boundary with
MSW (`src/test/mswServer.ts`/`mswHandlers.ts`) rather than hitting a
real API — appropriate for frontend unit/component tests, unlike
`apps/api`'s integration tests above. For genuine browser-level
end-to-end coverage against the real API and a real (test) database,
see `apps/web/tests-e2e/auth.spec.ts` and run:

```bash
pnpm --filter @academy-library/web build
DATABASE_URL="postgresql://academy:academy@localhost:5433/academy_library_test?schema=public" \
  pnpm --filter @academy-library/api dev &
pnpm --filter @academy-library/web preview &
pnpm --filter @academy-library/web test:e2e
```

Never point this at your dev database — the spec registers and signs
in real accounts it doesn't clean up, by design (each run uses a fresh,
uniquely-generated email, so repeat runs don't collide).

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
