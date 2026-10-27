-- Waitlist order (and RSVP order on the attendee list) is ORDER BY created_at, id.
--
-- now() is the transaction START time. Concurrent RSVPs start their
-- transactions in one order but acquire the event-row lock (FOR UPDATE) in
-- another, so with now() the stored order could disagree with the position
-- each user was told ("You're #1") and the wrong person got promoted.
--
-- clock_timestamp() is the time of the INSERT itself, which happens while
-- the lock is held, so it follows lock order: first to get the lock, first
-- in line. id (also assigned under the lock) still breaks exact ties.
ALTER TABLE waitlist ALTER COLUMN created_at SET DEFAULT clock_timestamp();
ALTER TABLE rsvps    ALTER COLUMN created_at SET DEFAULT clock_timestamp();
