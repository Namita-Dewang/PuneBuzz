# Pune Events Board — Project Spec

Oct 26, 2026 · @Bom

## Overview

A web app where people in Pune discover local events, RSVP, and get waitlisted automatically when an event fills up. The core technical challenge is seat allocation that stays correct under concurrent requests.

**MVP features**

- Sign up / log in (JWT)
- Browse events with filters: category, area, date range, free/paid, text search
- Event detail page with a live seats-left count
- RSVP and cancel; auto-waitlist when full; auto-promote the first waitlisted user when someone cancels
- Organizers create, edit and cancel their own events
- "My events" page: attending, waitlisted, organizing

**Out of scope for MVP:** payments, real-time sockets, email notifications, image uploads (see stretch goals).

## Tech stack

Plain JavaScript end to end, PostgreSQL for the database, REST between client and server.

| Layer | Choice | Why |
| --- | --- | --- |
| Frontend | React + Vite, React Router | Fast dev server, simple routing |
| Data fetching | Axios + TanStack Query | Caching, refetch on focus keeps seat counts fresh |
| Styling | Tailwind CSS | Quick, consistent UI |
| Backend | Node.js + Express | Minimal REST framework |
| Database | PostgreSQL + `pg` (node-postgres) | Raw SQL so you learn transactions and locking directly |
| Auth | JWT + bcrypt | Stateless auth, hashed passwords |
| Validation | Zod | Same schemas readable on both sides |
| Testing | Jest + Supertest | API tests, including a concurrency test |
| Dev setup | Docker Compose (Postgres) | One command to run the DB |
| Deploy | Render or Railway (API + DB), Vercel (frontend) | Free tiers |

## Database schema

Five tables. Each event row stores `seats_taken` alongside `capacity`, so checking for a free seat is a single-row lock instead of a count over all RSVPs.

| Table | Purpose | Key columns |
| --- | --- | --- |
| `users` | Accounts | id, name, email (unique), password\_hash, role |
| `venues` | Reusable locations | id, name, area, address, lat, lng |
| `events` | Event listings | id, organizer\_id, venue\_id, title, category, starts\_at, capacity, seats\_taken, status |
| `rsvps` | Confirmed seats | event\_id + user\_id (unique), created\_at |
| `waitlist` | Queue when full | event\_id + user\_id (unique), position via created\_at |

```sql
CREATE TABLE users (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          VARCHAR(20) NOT NULL DEFAULT 'user'
                CHECK (role IN ('user', 'organizer', 'admin')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE venues (
  id       SERIAL PRIMARY KEY,
  name     VARCHAR(150) NOT NULL,
  area     VARCHAR(100) NOT NULL,   -- e.g. Koregaon Park, Baner, Kothrud
  address  TEXT,
  lat      NUMERIC(9,6),
  lng      NUMERIC(9,6)
);

CREATE TABLE events (
  id            SERIAL PRIMARY KEY,
  organizer_id  INT NOT NULL REFERENCES users(id),
  venue_id      INT REFERENCES venues(id),
  title         VARCHAR(200) NOT NULL,
  description   TEXT,
  category      VARCHAR(50) NOT NULL,  -- tech, music, sports, food, workshop...
  starts_at     TIMESTAMPTZ NOT NULL,
  ends_at       TIMESTAMPTZ,
  capacity      INT NOT NULL CHECK (capacity > 0),
  seats_taken   INT NOT NULL DEFAULT 0,
  price         NUMERIC(10,2) NOT NULL DEFAULT 0,
  status        VARCHAR(20) NOT NULL DEFAULT 'published'
                CHECK (status IN ('draft', 'published', 'cancelled')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (seats_taken BETWEEN 0 AND capacity)
);

CREATE TABLE rsvps (
  id          SERIAL PRIMARY KEY,
  event_id    INT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id     INT NOT NULL REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);

CREATE TABLE waitlist (
  id          SERIAL PRIMARY KEY,
  event_id    INT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id     INT NOT NULL REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);

CREATE INDEX idx_events_starts_at ON events (starts_at);
CREATE INDEX idx_events_category  ON events (category);
CREATE INDEX idx_waitlist_queue   ON waitlist (event_id, created_at);
```

The `CHECK (seats_taken BETWEEN 0 AND capacity)` constraint is a safety net: even if application logic has a bug, the database refuses to overbook.

## REST API

All routes are prefixed with `/api/v1`. Responses are JSON. Errors use the shape `{ "error": { "code": "EVENT_FULL", "message": "..." } }`.

| Method | Endpoint | Auth | Purpose |
| --- | --- | --- | --- |
| POST | `/auth/register` | Public | Create account, returns JWT |
| POST | `/auth/login` | Public | Log in, returns JWT |
| GET | `/auth/me` | User | Current user profile |
| GET | `/events` | Public | List events. Query: `category`, `area`, `from`, `to`, `q`, `free`, `page`, `limit` |
| GET | `/events/:id` | Public | Event detail with `seatsLeft`, plus your status if logged in |
| POST | `/events` | Organizer | Create event |
| PATCH | `/events/:id` | Owner | Edit event (capacity can't drop below `seats_taken`) |
| DELETE | `/events/:id` | Owner | Cancel event (sets status, keeps history) |
| POST | `/events/:id/rsvp` | User | Book a seat; returns `{ status: "confirmed" }` or `{ status: "waitlisted", position: 4 }` |
| DELETE | `/events/:id/rsvp` | User | Cancel seat or leave waitlist; promotes next in line |
| GET | `/events/:id/attendees` | Owner | Confirmed list + waitlist |
| GET | `/me/events` | User | Attending, waitlisted, organizing |
| GET | `/venues` | Public | List venues for the create-event form |
| POST | `/venues` | Organizer | Add a venue |

**Status codes to use deliberately:** 201 on create, 400 validation, 401 no token, 403 not owner, 404 missing, 409 already RSVP'd or event cancelled.

**Pagination response shape:** `{ data: [...], page: 1, limit: 20, total: 134 }`.

## RSVP and waitlist logic

Every RSVP and cancellation runs inside one transaction that locks the event row with `SELECT ... FOR UPDATE`. Two people clicking "RSVP" for the last seat at the same moment are forced to queue: one gets the seat, the other is waitlisted.

**RSVP flow**

1. Begin transaction; lock the event row.
2. Reject if the event is cancelled or already started (409).
3. Reject if the user already has an RSVP or waitlist entry (409).
4. If `seats_taken < capacity`: insert into `rsvps`, increment `seats_taken`, return `confirmed`.
5. Otherwise: insert into `waitlist`, compute position, return `waitlisted`.
6. Commit.

**Cancel flow**

1. Begin transaction; lock the event row.
2. If the user is only on the waitlist: delete that row, commit.
3. If confirmed: delete the RSVP. Take the oldest waitlist entry; if one exists, move it into `rsvps` (seat count unchanged). If none, decrement `seats_taken`.
4. Commit.

```javascript
// src/services/rsvp.service.js
const pool = require('../db/pool');
const AppError = require('../utils/AppError');

async function rsvp(eventId, userId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `SELECT id, capacity, seats_taken, status, starts_at
         FROM events WHERE id = $1 FOR UPDATE`,
      [eventId]
    );
    const event = rows[0];
    if (!event) throw new AppError(404, 'EVENT_NOT_FOUND', 'Event not found');
    if (event.status !== 'published' || new Date(event.starts_at) < new Date()) {
      throw new AppError(409, 'EVENT_CLOSED', 'Event is not open for RSVP');
    }

    const existing = await client.query(
      `SELECT 1 FROM rsvps WHERE event_id = $1 AND user_id = $2
       UNION ALL
       SELECT 1 FROM waitlist WHERE event_id = $1 AND user_id = $2`,
      [eventId, userId]
    );
    if (existing.rowCount) throw new AppError(409, 'ALREADY_JOINED', 'Already RSVP\'d or waitlisted');

    let result;
    if (event.seats_taken < event.capacity) {
      await client.query('INSERT INTO rsvps (event_id, user_id) VALUES ($1, $2)', [eventId, userId]);
      await client.query('UPDATE events SET seats_taken = seats_taken + 1 WHERE id = $1', [eventId]);
      result = { status: 'confirmed' };
    } else {
      await client.query('INSERT INTO waitlist (event_id, user_id) VALUES ($1, $2)', [eventId, userId]);
      const pos = await client.query('SELECT COUNT(*)::int AS n FROM waitlist WHERE event_id = $1', [eventId]);
      result = { status: 'waitlisted', position: pos.rows[0].n };
    }

    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function cancel(eventId, userId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT id FROM events WHERE id = $1 FOR UPDATE', [eventId]);

    const left = await client.query(
      'DELETE FROM waitlist WHERE event_id = $1 AND user_id = $2', [eventId, userId]
    );
    if (left.rowCount) { await client.query('COMMIT'); return { status: 'left_waitlist' }; }

    const removed = await client.query(
      'DELETE FROM rsvps WHERE event_id = $1 AND user_id = $2', [eventId, userId]
    );
    if (!removed.rowCount) throw new AppError(404, 'NOT_JOINED', 'No RSVP to cancel');

    const next = await client.query(
      `DELETE FROM waitlist
        WHERE id = (SELECT id FROM waitlist WHERE event_id = $1
                    ORDER BY created_at LIMIT 1)
        RETURNING user_id`,
      [eventId]
    );
    if (next.rowCount) {
      await client.query('INSERT INTO rsvps (event_id, user_id) VALUES ($1, $2)',
        [eventId, next.rows[0].user_id]);
    } else {
      await client.query('UPDATE events SET seats_taken = seats_taken - 1 WHERE id = $1', [eventId]);
    }

    await client.query('COMMIT');
    return { status: 'cancelled', promotedUserId: next.rows[0]?.user_id ?? null };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { rsvp, cancel };
```

**Prove it works:** write a Jest test that creates an event with capacity 5, fires 20 RSVP requests in parallel with `Promise.all`, and asserts exactly 5 confirmed and 15 waitlisted. Removing `FOR UPDATE` should make this test fail, which is a great thing to demo in interviews.

## Folder structure

One repo with `server/` and `client/` folders. The backend is layered as routes → controllers → services → db, so SQL never leaks into controllers.

```text
pune-events/
├── docker-compose.yml          # Postgres for local dev
├── README.md
├── server/
│   ├── package.json
│   ├── .env.example            # DATABASE_URL, JWT_SECRET, PORT
│   ├── src/
│   │   ├── app.js              # express app, middleware, routes
│   │   ├── server.js           # starts the HTTP server
│   │   ├── config/
│   │   │   └── env.js
│   │   ├── db/
│   │   │   ├── pool.js         # pg Pool
│   │   │   ├── migrations/     # 001_init.sql, 002_indexes.sql
│   │   │   └── seed.js         # sample venues + events across Pune areas
│   │   ├── routes/
│   │   │   ├── auth.routes.js
│   │   │   ├── events.routes.js
│   │   │   ├── venues.routes.js
│   │   │   └── me.routes.js
│   │   ├── controllers/        # parse req, call service, send res
│   │   ├── services/           # business logic + SQL (rsvp.service.js)
│   │   ├── middleware/
│   │   │   ├── auth.js         # verify JWT, attach req.user
│   │   │   ├── requireRole.js
│   │   │   ├── validate.js     # Zod schema runner
│   │   │   └── errorHandler.js
│   │   ├── validators/         # Zod schemas per route
│   │   └── utils/
│   │       └── AppError.js
│   └── tests/
│       ├── auth.test.js
│       ├── events.test.js
│       └── rsvp.concurrency.test.js
└── client/
    ├── package.json
    ├── vite.config.js
    └── src/
        ├── main.jsx
        ├── App.jsx             # routes
        ├── api/
        │   ├── axios.js        # base URL + JWT interceptor
        │   ├── events.js
        │   └── auth.js
        ├── context/
        │   └── AuthContext.jsx
        ├── hooks/              # useEvents, useEvent, useRsvp (TanStack Query)
        ├── components/
        ├── pages/
        └── utils/
```

## Frontend pages and components

Seven pages cover the MVP. Protected pages redirect to login when there's no token.

| Route | Page | Access | Main pieces |
| --- | --- | --- | --- |
| `/` | Home / Browse | Public | `FilterBar`, `EventCard` grid, `Pagination` |
| `/events/:id` | Event detail | Public | `SeatMeter`, `RsvpButton` (confirmed / waitlisted #4 / full / closed states) |
| `/login`, `/register` | Auth | Public | `AuthForm` |
| `/me` | My events | User | Tabs: Attending, Waitlisted, Organizing |
| `/events/new` | Create event | Organizer | `EventForm`, `VenueSelect` |
| `/events/:id/edit` | Edit event | Owner | `EventForm` prefilled |
| `/events/:id/manage` | Attendees | Owner | `AttendeeTable`, waitlist list, cancel event |

**Shared components:** `Navbar`, `ProtectedRoute`, `EmptyState`, `Spinner`, `Toast`.

**UX details worth doing:**

- Optimistic update on RSVP, rolled back if the API returns 409
- Refetch the event every 15 seconds on the detail page so the seat meter stays roughly live
- Filters synced to the URL query string, so a filtered list is shareable
- Show the waitlist position after joining ("You're #3 in line")

## Build order

About four weeks at evenings and weekends pace. Each milestone ends with something runnable.

**Week 1: Backend foundation**

- [ ] Docker Compose with Postgres; run the migration SQL
- [ ] Express app skeleton, error handler, `AppError`
- [ ] Register / login / me with bcrypt + JWT
- [ ] Seed script with \~10 venues across Pune areas and \~30 events

**Week 2: Events and RSVP API**

- [ ] Events CRUD with owner checks and Zod validation
- [ ] `GET /events` with filters, search and pagination
- [ ] RSVP and cancel service with transactions
- [ ] Concurrency test passing (20 parallel requests, capacity 5)

**Week 3: Frontend**

- [ ] Vite + Tailwind + Router setup, Axios interceptor, AuthContext
- [ ] Browse page with filters synced to the URL
- [ ] Event detail with `RsvpButton` states and seat meter
- [ ] My events page

**Week 4: Organizer tools and ship**

- [ ] Create, edit, manage pages
- [ ] Swagger docs at `/api/docs`
- [ ] Deploy API + DB (Render or Railway) and frontend (Vercel)
- [ ] README with screenshots, architecture notes, and the concurrency test explained

**Stretch goals** (pick one or two once the MVP ships)

- Live seat counts over WebSockets (Socket.IO)
- Email when you're promoted off the waitlist (Nodemailer + a job queue)
- Event cover images (Cloudinary or S3)
- Map view of events with Leaflet
- Paid events with Razorpay test mode
- Rate limiting on RSVP endpoints (`express-rate-limit`)
