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
  -- Safety net: the database refuses to overbook even if app logic has a bug.
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
