# Architecture decisions and assumptions

Lightweight decision log, starting with Task 01 (project foundation).
Newer entries are added at the bottom of each section as the project
evolves.

## Stack choices within the approved list

- **Node.js 22 (LTS)** was chosen over Node 24/25 as the Docker/CI baseline.
  22 is the current Active/Maintenance LTS line at the time of writing;
  24 only recently became LTS and 25 is a Current (non-LTS) release. Local
  development works on any Node ≥ 22 — the repo does not pin an exact
  patch version. See `.nvmrc` and `engines.node` in the root
  `package.json`.
- **Express 5** (not 4). Express 5 forwards rejected promises from async
  route handlers to error-handling middleware automatically, which removes
  the need for a hand-rolled `asyncHandler` wrapper around every route —
  directly relevant to the "consistent error handling" requirement.
- **React Router v6 (Data Mode)**, not v7. The task calls for "Data Mode"
  (`createBrowserRouter`, loaders, `lazy` routes), which is a v6.4+
  capability that v7 continues under a renamed package. v6 is used here in
  **library mode** (plain `react-router-dom`), not v7's "framework mode"
  Vite plugin, since the task asks for a standalone Vite + React setup with
  routing configured explicitly, not a meta-framework.
- **Zod v3**, not the newer v4 line, for broader ecosystem compatibility
  with the other libraries pinned here at the time of writing.
- **Vitest + React Testing Library + Supertest** for unit/integration
  tests, **Playwright configured but not wired into CI** — see "Testing
  strategy" below.

## Monorepo & tooling

- **pnpm workspaces**, not Turborepo/Nx. The task's scope (2 apps, 2
  packages) doesn't yet justify a build-orchestration tool; `pnpm -r` with
  `--filter` covers it. Revisit if the number of packages or the need for
  cross-package build caching grows significantly.
- **One root ESLint flat config** (`eslint.config.mjs`) instead of
  per-package configs. TypeScript compiler strictness is still shared via
  `packages/config/tsconfig.*.json`, but linting the whole repository from
  a single config is simpler at this scale and keeps rules consistent
  across `apps/web` and `apps/api`.
- **No Turborepo-style remote caching, no changesets/versioning** — this is
  a private, non-published monorepo; semantic versioning across packages
  isn't a current need.

## packages/contracts

- Contains **only infrastructure contracts** (health/ready responses, the
  API error envelope) — deliberately no business entities, per the task's
  explicit scope boundary. The first real business schema (e.g. a
  `Resource`) should be added here, not duplicated between `web` and `api`.

## Database

- **`SchemaProbe` is a deliberate placeholder model**, not a real entity.
  Its only purpose is to prove the Prisma → PostgreSQL pipeline (schema →
  migration → generated client → live query via `/api/v1/ready`) works
  end-to-end without inventing business schema ahead of scope. It should be
  dropped in the task that introduces the first real model, via a normal
  migration (`prisma migrate dev`), not by hand-editing migration history.
- Migrations are **Prisma's own migration history**
  (`apps/api/prisma/migrations/`), not a separate tool — see
  [`docs/development.md`](../development.md) for how they run locally vs.
  in Docker/production.

## Docker

- **`pnpm deploy` was tried and abandoned** for the API's production image.
  It produces a pruned, "injected" `node_modules` from pnpm's
  content-addressable store, but the Prisma client is generated **directly
  into `node_modules`** by `prisma generate` — that generated output isn't
  part of pnpm's store bookkeeping, and `pnpm deploy` silently failed to
  carry it into the deployed tree (symptom: `Cannot find module
'@prisma/client'` / a broken CJS/ESM interop error inside the running
  container, despite the exact same code working outside Docker). The
  Dockerfile instead builds the whole workspace, runs `pnpm prune --prod`
  **in place**, and copies that entire pruned tree into the runtime image.
  This is a larger image than a hand-trimmed deploy would produce; revisit
  if image size becomes a real constraint.
- A separate **`migrate` Compose service** (not a migration step baked into
  the API image's entrypoint) runs `prisma migrate deploy` before `api`
  starts (`depends_on: condition: service_completed_successfully`). It
  targets the Dockerfile's `build` stage, which still has the `prisma` CLI
  (a devDependency) available — the pruned `runtime` image intentionally
  does not.
- **Compose healthchecks use `127.0.0.1`, not `localhost`.** Alpine's
  `wget` resolved `localhost` to the IPv6 loopback (`::1`) first, but the
  API binds only to IPv4 `0.0.0.0` — every healthcheck probe failed with
  "connection refused" even though the server was running and reachable on
  IPv4. Any future healthcheck or in-container HTTP probe should use
  `127.0.0.1` for the same reason.
- `apps/*/tsconfig.build.tsbuildinfo` files (from local `incremental: true`
  TypeScript builds) were getting copied into the Docker build context and
  made `tsc` under-emit (it trusted a stale cache that didn't match the
  container's empty `dist/`, and only recompiled the files it considered
  "changed"). Fix: removed `incremental`/`composite` from the shared
  `tsconfig.base.json` entirely rather than just `.dockerignore`-ing the
  cache file, since the same class of bug could otherwise resurface locally
  (e.g. after switching branches). `*.tsbuildinfo` is still ignored in both
  `.gitignore` and `.dockerignore` defensively.
- Both production images run as **non-root** (`academy` user for the API,
  the stock `nginx` user for the web image, which `index.html` falls back
  to via Nginx's `try_files` for client-side routing).

## Testing strategy

- **React Router's data router (`createBrowserRouter`) is not mounted in
  unit tests.** It calls `.initialize()` eagerly, which constructs a
  `Request`/`AbortSignal` internally — under Vitest's `jsdom` environment
  this throws (`Expected signal to be an instance of AbortSignal`), a known
  jsdom/Node `fetch` polyfill mismatch (jsdom's `AbortController` differs
  from the one Node's built-in `Request` expects). Rather than fight that
  mismatch, `router.tsx` (which calls `createBrowserRouter`) and
  `routes.tsx` (the plain route-object array, with no router
  construction) were split so tests can assert the route configuration's
  shape and render individual page components (wrapped in the classic,
  non-data `<MemoryRouter>` where a router context is needed) without ever
  constructing the real data router. The real data router is exercised by
  the browser (and would be by Playwright e2e, once wired into CI).
- **Playwright is configured but not run in CI** — there are no business
  screens yet worth an end-to-end suite. `apps/web/playwright.config.ts`
  and `apps/web/tests-e2e/` exist so the next task that adds a real user
  flow can start writing e2e tests immediately.

## Out of scope for Task 01 (confirmed against the task brief)

- No business entities, authentication, or RBAC.
- No dashboard/sidebar/resource-card UI — only a placeholder home page and
  a 404 page.
- No Reel/Skill Map/Depot integration code.

---

# Task 02 — design system

Full rationale for tokens, theming, and the component catalog lives in
[`docs/design-system/README.md`](../design-system/README.md); this
section covers decisions outside that doc's scope.

## New dependencies

- **`@hookform/resolvers`** — the standard glue between React Hook Form
  and Zod (both already approved/installed in Task 01). Needed to wire
  the Forms showcase section's Zod schema into `useForm`; without it
  there's no supported way to connect the two.
- **`@testing-library/user-event`** — standard companion to React
  Testing Library for realistic click/type/keyboard interaction tests
  (clicking, typing, `Tab`, arrow keys). The task explicitly asked for
  interaction tests, not render-only ones; `fireEvent` alone doesn't
  simulate real browser event sequences well enough for things like
  focus-trap Tab-wrapping.
- No other dependencies were added — all overlay behavior (portal, focus
  trap, outside-click, escape, scroll lock, focus restoration) is
  hand-rolled in `shared/hooks/` rather than pulling in Radix/Headless
  UI/Floating UI, per the task's "no pre-styled component libraries"
  constraint and to keep the dependency surface small.

## Component architecture

- **`Dropdown` is deliberately not portaled**, unlike `Modal`. A
  portaled menu (appended to `document.body`) breaks natural Tab order
  — pressing Tab to leave the menu would jump to whatever happens to be
  next in `document.body`'s child order, not the next element after the
  trigger visually. `Dropdown`'s menu is `position: absolute` inside a
  `position: relative` wrapper right next to the trigger instead, which
  keeps Tab order correct at the cost of being clippable by an
  `overflow: hidden` ancestor — acceptable for a design-system primitive
  with no such ancestor yet; revisit with real positioning (Floating UI)
  if that becomes a problem.
- **Badges, by default, use soft tinted backgrounds with a darker
  text/icon of the same hue, not solid fills with white text.** Several
  of the brief's suggested semantic colors (warning in particular)
  don't have enough contrast against white to use as a white-label solid
  fill at all — tinted badges sidestep that problem entirely and also
  read as more "premium and restrained" per the brief's own direction.
  `Button`'s `destructive` variant still needs a solid white-label fill
  (it's an explicit requirement), which is why `--color-danger-fill` was
  split out from `--color-danger` — see the design-system doc.
- **`Tooltip` takes a single child via `cloneElement`**, not a
  render-prop or a wrapping trigger component, to keep
  `<Tooltip content="...">`'s call sites simple. This constrains
  `children` to `ReactElement<TooltipTriggerProps>` (a small local
  interface listing just the handlers it injects) specifically to avoid
  `any`-typed access to `children.props` under this repo's
  type-checked-lint rules.

## Testing environment gaps found and fixed

Two real bugs surfaced only once multi-test-case component test files
were added (Task 01's single HomePage test never exercised either path):

- **React Testing Library's auto-cleanup never ran.** It only
  self-registers against a _global_ `afterEach`, and this project's
  `vitest.config.ts` doesn't set `test.globals: true` — every test in a
  file was rendering into the same document without unmounting the
  previous one. Fixed with an explicit `afterEach(cleanup)` in
  `src/test/setup.ts`.
- **jsdom here doesn't provide a working `localStorage` or
  `window.matchMedia`** (methods exist but throw/aren't callable) —
  both are polyfilled in the same setup file: a minimal in-memory
  `Storage` implementation, and a `matchMedia` stub that always reports
  `matches: false`.
- **A genuine focus-restoration race**, not just a test artifact:
  `useRestoreFocus` captured `document.activeElement` in a passive
  `useEffect`, but `Modal`'s focus trap (and `DropdownMenu`'s
  "focus the first item" effect) are _also_ passive effects that move
  focus into the newly-opened content — and effect order across
  components isn't guaranteed to put the capture first. The captured
  "previously focused element" ended up being the modal's own close
  button, which then unmounts, so focus silently fell back to
  `<body>` on close. Fixed by moving the capture to `useLayoutEffect`:
  all layout effects across the tree run before any passive effect,
  regardless of component position, so it now reliably wins the race.

## Out of scope for Task 02 (confirmed against the task brief)

- No resource CRUD, Prisma models, or other backend/business logic.
- No final sidebar/dashboard layout or full business pages — `RootLayout`
  only gained a `ThemeToggle` in its existing header.
- `Pagination` and `Alert`'s "assertive" live-region variant for errors
  specifically were the two items from the suggested component list
  intentionally left out: `Pagination` has nothing to paginate yet
  (there's no list/table anywhere in the app), and splitting toast
  announcements across a polite/assertive pair of live regions by
  variant felt like premature complexity for a notification system with
  exactly one consumer so far.
