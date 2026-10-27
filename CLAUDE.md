# CLAUDE.md

Pune Events Board: a web app for discovering local Pune events, RSVPing, and getting waitlisted automatically when an event is full. The hard part is seat allocation that stays correct under concurrent requests.

The full plan is in `docs/SPEC.md`. Read it before building a feature. If this file and the spec disagree, the spec wins; update this file to match.

**Status:** the MVP is complete, including Swagger docs, helmet, rate limits and the README. Deployment config is in place: `render.yaml` (API + Postgres on Render) and `client/vercel.json` (client on Vercel); the walkthrough is in `docs/DEPLOYMENT.md`. Render's start command runs `npm run migrate` before `npm start`, so new migrations deploy automatically.

## Stack

Plain JavaScript everywhere. **No TypeScript**: no `.ts`/`.tsx` files, no `tsconfig`.

| Layer | Choice |
| --- | --- |
| Backend | Node.js 20+ + Express 5, CommonJS (`require` / `module.exports`) |
| Database | PostgreSQL via `pg` (node-postgres), raw SQL, **no ORM or query builder** |
| Auth | JWT + bcrypt |
| Validation | Zod |
| Backend tests | Jest + Supertest |
| Frontend | React + Vite, React Router, ES modules, `.jsx` |
| Data fetching | Axios + TanStack Query |
| Styling | Tailwind CSS |
| Local DB | Docker Compose (Postgres) |
| Deploy | Render or Railway (API + DB), Vercel (frontend) |

## Folder structure

One repo, with `server/` and `client/` at the root.

```text
docker-compose.yml            # Postgres for local dev
server/
  .env.example                # DATABASE_URL, JWT_SECRET, PORT
  src/
    app.js                    # express app, middleware, route mounting
    server.js                 # starts the HTTP server (only file that calls listen)
    config/env.js             # reads and validates env vars
    db/
      pool.js                 # the single shared pg Pool
      migrations/             # numbered SQL files: 001_init.sql, 002_indexes.sql, ...
      seed.js                 # sample venues + events across Pune areas
    routes/                   # <resource>.routes.js
    controllers/              # <resource>.controller.js
    services/                 # <resource>.service.js — business logic + SQL
    middleware/               # auth.js, requireRole.js, validate.js, errorHandler.js
    validators/               # <resource>.schemas.js — Zod schemas
    utils/AppError.js
  tests/                      # *.test.js, including rsvp.concurrency.test.js
client/
  vite.config.js
  src/
    main.jsx, App.jsx         # App.jsx holds the routes
    api/                      # axios.js (base URL + JWT interceptor), one file per resource
    context/AuthContext.jsx
    hooks/                    # TanStack Query hooks: useEvents, useEvent, useRsvp
    components/               # PascalCase.jsx
    pages/                    # PascalCase.jsx
    utils/
```

## Backend conventions

### Layering: routes → controllers → services → db

Each layer only calls the layer below it.

- **Routes**: wire up the path, middleware (`auth`, `requireRole`, `validate(schema)`), and controller. No logic.
- **Controllers**: read the validated input from `req`, call one service function, and send the response with the right status code. No SQL, no `pg` imports, no business rules.
- **Services**: hold the business logic and **all the SQL**. They take plain arguments (`eventId`, `userId`, `data`) and never see `req` or `res`. They throw `AppError` for expected failures.
- **db**: `db/pool.js` exports the one shared `Pool`. Only services import it.

### SQL

- SQL lives only in `services/`. If a controller or route needs data, add a service function.
- Always use parameterized queries (`$1, $2, ...`). Never build SQL by interpolating user input. For dynamic filters (e.g. `GET /events`), push clauses and values onto arrays and number the placeholders as you go. Sort columns must come from an allow-list.
- Any multi-step write uses a transaction on one checked-out client: `pool.connect()` → `BEGIN` → work → `COMMIT`, `ROLLBACK` in `catch`, `client.release()` in `finally`. `services/rsvp.service.js` in the spec shows the pattern.
- **RSVP and cancel must lock the event row with `SELECT ... FOR UPDATE`** inside the transaction. Don't remove the lock, and don't replace `seats_taken` with a `COUNT(*)` over `rsvps`. The concurrency test (capacity 5, 20 parallel RSVPs, expect exactly 5 confirmed and 15 waitlisted) must keep passing.
- Keep the `CHECK (seats_taken BETWEEN 0 AND capacity)` constraint as a last line of defence against overbooking.
- Queue order is `ORDER BY created_at, id` everywhere. `waitlist.created_at` and `rsvps.created_at` default to `clock_timestamp()` (migration 002), not `now()`. `now()` is the transaction *start* time, so concurrent RSVPs got a queue order that differed from the position they were told, and the wrong person was promoted (the concurrency test failed 8 times in 15). Don't change these defaults back to `now()`.
- Schema changes go in a new numbered migration file. Never edit a migration that has already been applied.
- DB columns are `snake_case`. JSON sent to the client is `camelCase` (e.g. `seatsLeft`, `startsAt`). Services do the mapping.

### Validation (Zod)

- Each route's body, query, and params schemas live in `validators/<resource>.schemas.js`.
- `middleware/validate.js` runs the schema and replaces `req.body` / `req.query` / `req.params` with the parsed values (coerced and with defaults applied). Controllers trust that input and don't re-validate.
- Use `z.coerce` for numeric query and route params (`page`, `limit`, `:id`).

### Errors

- Throw `new AppError(status, code, message)` for every expected failure, e.g. `new AppError(409, 'EVENT_CLOSED', 'This event is no longer taking bookings')`. Messages are shown to users as-is (e.g. in toasts), so write them in plain English. The user-facing word is "booking"/"book a seat", never "RSVP"; RSVP stays only in code names and API paths.
- Codes are `SCREAMING_SNAKE_CASE` and stable, because the client branches on them.
  - From the spec, still to be used: `EVENT_CLOSED`, `EVENT_FULL`, `ALREADY_JOINED`, `NOT_JOINED`.
  - In use: `EVENT_NOT_FOUND`, `EVENT_CANCELLED`, `CAPACITY_BELOW_SEATS_TAKEN`, `EVENT_HAS_ATTENDEES`, `INVALID_VENUE`, `EMAIL_TAKEN`, `INVALID_CREDENTIALS`, `AUTH_REQUIRED`, `INVALID_TOKEN`, `TOKEN_EXPIRED`, `FORBIDDEN`, `RATE_LIMITED`, `VALIDATION_ERROR`.
- `middleware/errorHandler.js` is the only place that formats error responses. Express 5 forwards rejected promises to it, so async controllers just `throw`; no try/catch or `asyncHandler` wrapper.
- **Every error response uses one shape:**

  ```json
  { "error": { "code": "EVENT_FULL", "message": "Human-readable message" } }
  ```

  Zod failures return 400 with code `VALIDATION_ERROR` and may add `error.details` listing the issues per field. Anything that isn't an `AppError` returns 500 with `INTERNAL_ERROR` and a generic message. Log the real error on the server; never send stack traces or SQL errors to the client.
- Services translate known Postgres errors into `AppError`s (e.g. unique violation `23505` → 409).
- Use status codes deliberately: 201 create, 400 validation, 401 missing or invalid token, 403 not the owner or wrong role, 404 not found, 409 conflict (already RSVP'd, event cancelled or closed).

### API

- Every route is under `/api/v1`. Responses are JSON.
- Response shapes:
  - Paginated lists return `{ data: [...], page, limit, total }`.
  - `GET /venues` returns `{ data }` with no pagination; the list is small.
  - Single resources are wrapped: `{ event }`, `{ venue }`, `{ user }`.
- Dynamic SQL (filters, PATCH): column names come only from a fixed allow-list (`WRITABLE_COLUMNS` in `events.service.js`), and values always go in as `$n` parameters. Escape `%`, `_` and `\` in user text that goes into `ILIKE`.
- Event visibility:
  - `GET /events` shows only published events starting from now, unless an explicit `from` is given.
  - A date-only `from`/`to` (`YYYY-MM-DD`) means that whole day in Pune time (`utils/puneTime.js`).
  - Drafts are visible only to their organizer and admins; everyone else gets 404. Cancelled events stay visible.
- Event changes:
  - Only the event's organizer or an admin can edit or cancel it.
  - Edits and cancellations lock the event row (`FOR UPDATE`), like RSVP and cancel do.
  - Raising capacity moves people off the waitlist, oldest first. The queue is always ordered by `(created_at, id)`.
- RSVP endpoints (`services/rsvp.service.js` follows the spec's flow):
  - `POST /events/:id/rsvp` → 201 `{ status: 'confirmed' }` or `{ status: 'waitlisted', position }`.
  - `DELETE /events/:id/rsvp` → 200 `{ status: 'cancelled' | 'left_waitlist' }`. The promoted user's id stays server-side.
  - `GET /events/:id/attendees` (organizer or admin) → `{ confirmed, waitlist }`, with names and emails.
  - `GET /me/events` → `{ attending, waitlisted (with position), organizing }`. It includes past and cancelled events and isn't paginated.
- `optionalAuth` (used on `GET /events/:id`) sets `req.user` when a valid token is sent and treats a bad or expired token as anonymous instead of returning a 401.
- `auth.js` verifies the JWT (HS256 only) and loads the user from the DB on every request into `req.user` (`{ id, name, email, role, createdAt }`), so role changes and deleted accounts take effect immediately. The token carries only `sub` (the user id). `requireRole('organizer', 'admin')` goes after `auth`. Owner checks (is this the event's organizer?) happen in the service.
- Never return `password_hash`. Select the explicit public columns (`USER_COLUMNS` in `auth.service.js`), never `SELECT *` on `users`.
- At sign-up people pick an account type: `role` is `user` (default) or `organizer`. `admin` and anything else is rejected with a 400. Admins are only ever set in the database. Never widen that enum.
- **API docs:** `src/docs/openapi.js` is served at `/api/docs` (Swagger UI) and `/api/docs.json`. Routers are mounted from `src/routes/index.js`, and `tests/docs.test.js` fails if a route is missing from the spec, or the spec lists one that doesn't exist. **Add or change a route → update `openapi.js` in the same change.**
- `helmet()` runs on every response. Its default CSP works with Swagger UI because the assets are same-origin. Keep it before `cors()`.
- `POST`/`DELETE /events/:id/rsvp` share a per-user limit (`rsvpLimiter`, `RSVP_MAX` per 10 min). It's keyed by user id, so it must come after `auth`.
- `/auth/login` and `/auth/register` are rate-limited per IP (`middleware/rateLimit.js`, limits set by `AUTH_LOGIN_MAX` / `AUTH_REGISTER_MAX`). A blocked request gets 429 `RATE_LIMITED`. Counts are kept in memory, so they're per process. `TRUST_PROXY` must match the deployment (1 behind Render/Railway), or every client shares the proxy's IP and therefore one limit.

## Frontend conventions

- Vite 8, React 19, React Router 7 (import from `react-router`, not `react-router-dom`), TanStack Query 5, and Tailwind 4 via `@tailwindcss/vite`. There's no `tailwind.config.js`; theme tokens go in `@theme` in `src/index.css`.
- All HTTP calls go through `src/api/axios.js`, which sets the base URL from `VITE_API_URL` and attaches the JWT. Components never call Axios directly; they use hooks in `src/hooks/` built on TanStack Query.
- The token lives in localStorage, accessed only through `src/utils/authStorage.js`, which also syncs logins and logouts across tabs.
- The response interceptor logs out only on a 401 with `AUTH_REQUIRED` / `INVALID_TOKEN` / `TOKEN_EXPIRED` for a request that sent a token. Never log out on other 401s: a wrong password is `INVALID_CREDENTIALS`.
- `useAuth()` (`src/context/AuthContext.jsx`) gives `user`, `isLoading`, `sessionExpired`, `hasRole()`, `login()`, `register()` and `logout()`. Any logout clears the whole query cache.
- Read API errors with `src/utils/apiError.js`: `getErrorMessage`, `getErrorCode`, and `getFieldErrors`, which turns `body.email` details into `{ email }`.
- Queries don't retry 4xx errors (set in `main.jsx`).
- Query keys: `['events','list',filters]`, `['events','detail',id]`, `['me','events']`, `['venues']`, `['auth','me',token]`. A login invalidates everything except `auth`; a logout clears everything.
- Browse filters live only in the URL (`hooks/useEventFilters.js`). Bad params are dropped rather than sent to the API, any filter change resets to page 1, and search is debounced 300 ms with `replace: true` so typing doesn't fill the history.
- RSVPs (`hooks/useRsvp.js`) are optimistic. `afterJoin`/`afterLeave` mirror the server's seat logic. On error the previous state is restored and a toast shows the API message for a 409. When the request settles, the event, the lists and `me/events` are invalidated. The detail page polls every 15 s, pausing while an RSVP is in flight and stopping for cancelled events.
- RSVP states come from `rsvpState()` in `RsvpButton.jsx`: closed (cancelled / draft / started) beats everything, then login, confirmed, waitlisted, open, full. Giving up a seat or a waitlist spot needs a second click to confirm.
- Shared UI: `Toast` (`useToast().show(msg, 'success' | 'error')`), `EmptyState`, `Spinner`, `CategoryChip`, `EventStatusBadge`, `ConfirmDialog` (native `<dialog>`), and `FormField` plus `inputClass()`. Times are always shown in IST (`utils/format.js`).
- Organizer UI:
  - Hide it with `hasRole('organizer', 'admin')` (navbar link, Create button, Organizing tab) and `canManage(event)` (Edit/Manage on event pages). This mirrors the server's `canManage`.
  - `/events/new` is behind `ProtectedRoute roles`. Edit and manage check ownership on the page, because a demoted organizer still owns their events. The API enforces all of this regardless.
- `EventForm` (`components/EventForm.jsx`, `utils/eventForm.js`):
  - Form values are strings. `datetime-local` values are Pune wall-clock time, converted with `fromPuneInputValue` / `toPuneInputValue`.
  - Validation mirrors the server's Zod rules and runs on submit, then live.
  - Server field errors and the codes in `ERROR_CODE_FIELDS` show under their field.
  - Edit sends a PATCH with only the changed fields (`formToUpdatePayload`), so an unchanged start time in the past isn't re-sent and rejected.
- `/me?tab=attending|waitlisted|organizing`: the tab lives in the URL; each list shows upcoming events first, then a "Past and cancelled" section.
- **Design system: "Pune Buzz, the city's evenings, gathered in one place".** Warm, editorial, not a SaaS dashboard.
  - **Tokens** live only in `client/tailwind.config.js`, loaded via `@config` in `src/index.css`. They're semantic colours (`canvas`, `surface`, `sunken`, `ink`, `ink-muted`, `line`, `accent`, `success`, `warning`, `closed`, `danger`, `cat-*`…), and each is a CSS variable with a light value (`:root`) and a dark value (`.dark`).
  - **Never use raw hex values or Tailwind palette colours** (`stone-500`, `orange-600`…) in components. A grep check for that came back clean.
  - **Dark mode** uses the class strategy: `utils/theme.js` plus `ThemeToggle`, and an inline script in `index.html` applies it before first paint.
  - **Fonts:** Fraunces (`font-display`) for headings and Inter (`font-sans`) for body text, from Google Fonts. Type scale: `text-display` / `text-title` / `text-heading`; body copy is capped at `max-w-prose` (65ch).
  - **Icons:** `lucide-react` only. It has no brand logos, so the GitHub mark in `Footer.jsx` is inline SVG.
  - **Motion:** only 150–200ms transitions on hover and focus. No entrance animations. Skeletons pulse while loading.
  - **Focus rings:** visible on everything (global `:focus-visible` in `index.css`).
  - **Layout:** must work at 375px with no horizontal scroll. Content width is `max-w-page`.
- **UI kit** in `src/components/ui/` (import from `components/ui`): `Button` (primary/secondary/ghost/danger/danger-outline, sizes sm/md/lg, `loading`, `as={Link}`), `Input`/`Textarea`, `Select`, `Field` (label, hint and error wired up for screen readers), `Badge`, `Card` (`interactive` adds the hover lift), `Tabs`, `Modal` (native `<dialog>`), `Skeleton`, `EmptyState` (always pass an `action`), `Toast`/`useToast`, and `Spinner`/`SpinnerIcon` (button use only).
  - **Loading** uses page-shaped skeletons from `components/Skeletons.jsx`.
- **Layout pieces:**
  - The sticky `Navbar` has an avatar menu on desktop and a hamburger below `md`, both built on `hooks/useDisclosure.js`.
  - `ScrollToTop` resets scroll on path changes except Back/Forward, and `scroll-padding-top` clears the sticky bar.
  - On the event page, the single `RsvpButton` sits in the sticky card on `lg` and is docked to the bottom on smaller screens (`[data-booking-dock]`; `index.css` adds bottom padding to the body).
- **Footer GitHub link:** reads `VITE_GITHUB_URL` (`client/.env`).
- **Category colours:** tech indigo, music rose, sports emerald, food amber, workshop sky. Each has `cat-*` and `cat-*-soft` tokens with light and dark values.
  - Always go through `categoryTheme(category)` in `utils/constants.js` (dot / text / badge / chip / band / glyph classes) and `CategoryLabel` (`label` | `badge` | `pill`).
  - Bands have their own `dark:` fills; pastels at low opacity over a dark surface look muddy.
- **Shadows** are theme tokens (`--pb-shadow-*`): warm on light, deeper black on dark.
- **Typographic rhythm:**
  - Use `PageHeader` (eyebrow → title → description/meta, with actions) and `SectionHeader` from the kit rather than hand-rolled headings.
  - Use `tabular-nums` on dates, times, seat counts and prices.
- **The one animation:** the booking success moment in `RsvpButton`. The same button turns green with an animated check for 1.6s, then the confirmed panel appears. It uses `motion-safe:` only, so reduced motion gets a static check. Everything else animates only on hover and focus.
- **Home extras:** read-only `GET /events` queries in `hooks/useEventHighlights.js` (the week count and the weekend row), keyed under `['events', …]`. The weekend row hides while filtering.
- Protected pages are wrapped in `ProtectedRoute`, which redirects to `/login` when there's no token.
- Event detail refetches every 15s. RSVP updates optimistically and rolls back on 409. Browse filters are synced to the URL query string.
- Use Tailwind utility classes; avoid separate CSS files unless there's a reason.

## Running things

```bash
# Database (repo root): Postgres 16, data in the named volume `pgdata`
docker compose up -d --wait          # start Postgres and wait until it's healthy
docker compose down                  # stop it (add -v to wipe the data)

# Server (from server/)
cp .env.example .env                 # first time only
npm install
npm run migrate                      # apply new db/migrations/*.sql files, tracked in schema_migrations
npm run seed                         # WIPES all tables, then loads 3 test users, 10 venues, 30 events (prints logins)
npm run dev                          # API on http://localhost:4000/api/v1, auto-reload
npm start                            # same, without nodemon
npm test                             # Jest + Supertest against pune_events_test (Postgres must be running)
npx jest tests/auth.test.js -t "login"   # a single file or test
```

```bash
# Client (from client/), with the API running
cp .env.example .env                 # first time only; VITE_API_URL=http://localhost:4000/api/v1
npm install
npm run dev                          # http://localhost:5173 (the port is fixed because the API's CORS allows exactly it)
npm run build                        # production build into client/dist
```

Seed data:
- Logins: `organizer1@punebuzz.test` / `Organizer1!pass`, `organizer2@punebuzz.test` / `Organizer2!pass`, `user@punebuzz.test` / `User1!password`.
- Event dates are relative to the day you seed, so re-seed when they go stale.
- Five events have capacity 2–3 for testing the waitlist.
- The seed refuses to run with `NODE_ENV=production`.

Tests run against a real Postgres database, not mocks, because the concurrency test depends on real row locking.

- `tests/testEnv.js` points `DATABASE_URL` at `TEST_DATABASE_URL` (default `pune_events_test`). It refuses to run unless the database name ends in `_test`.
- `tests/globalSetup.js` creates that database if it's missing and runs the migrations.
- Each test file calls `resetDb()` from `tests/helpers/db.js` in `beforeEach` and `pool.end()` in `afterAll`.
- Tests run with `--runInBand` because files share one database.
- Tests use `BCRYPT_ROUNDS=4` for speed.

## Working rules

- Build in the order of the spec's "Build order" section. Each milestone should end with something that runs.
- MVP scope only. Payments, WebSockets, email, and image uploads are stretch goals; don't start them without asking.
- Never commit `.env` or secrets.
