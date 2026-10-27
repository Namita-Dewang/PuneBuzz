-- Volunteer roles on events, and people's applications to them.
--
-- A role has `spots`; a spot is only used up when the organizer ACCEPTS an
-- application. spots_filled is that accepted count, kept on the role row
-- (like events.seats_taken) so "is there room?" is a single-row check under
-- a row lock, and the CHECK refuses to overfill even if app code had a bug.

CREATE TABLE volunteer_roles (
  id            SERIAL PRIMARY KEY,
  event_id      INT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  title         VARCHAR(100) NOT NULL,
  description   TEXT,
  spots         INT NOT NULL CHECK (spots BETWEEN 1 AND 1000),
  spots_filled  INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CHECK (spots_filled BETWEEN 0 AND spots)
);

CREATE INDEX idx_volunteer_roles_event ON volunteer_roles (event_id);

-- One application per person per role. Answers to the five application
-- questions are stored as columns so they export cleanly to Excel.
CREATE TABLE volunteer_applications (
  id                  SERIAL PRIMARY KEY,
  role_id             INT NOT NULL REFERENCES volunteer_roles(id) ON DELETE CASCADE,
  user_id             INT NOT NULL REFERENCES users(id),
  status              VARCHAR(20) NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'accepted', 'declined')),
  motivation          TEXT NOT NULL,          -- Q1 why are you excited
  volunteered_before  BOOLEAN NOT NULL,       -- Q2 have you volunteered before
  past_experience     TEXT,                   -- Q2 follow-up (optional)
  skills              TEXT,                   -- Q3 skills you bring (optional)
  availability        VARCHAR(20) NOT NULL    -- Q4 how much of the event
                      CHECK (availability IN ('full', 'partial', 'setup')),
  phone               VARCHAR(20) NOT NULL,   -- Q5 contact number (organizer only)
  created_at          TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  decided_at          TIMESTAMPTZ,
  UNIQUE (role_id, user_id)
);

CREATE INDEX idx_volunteer_applications_user ON volunteer_applications (user_id);
