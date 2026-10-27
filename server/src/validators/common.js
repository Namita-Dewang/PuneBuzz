const { z } = require('zod');

// SERIAL ids are int4; anything larger would make Postgres throw.
const MAX_INT4 = 2147483647;

const id = z.coerce.number().int().positive().max(MAX_INT4);

const idParams = z.object({ id });

// An ISO 8601 datetime with an explicit offset (Z or +05:30), as a Date.
const dateTime = z.iso
  .datetime({ offset: true, message: 'Must be an ISO 8601 datetime with a time zone, e.g. 2026-11-01T18:30:00+05:30' })
  .transform((s) => new Date(s));

module.exports = { MAX_INT4, id, idParams, dateTime };
