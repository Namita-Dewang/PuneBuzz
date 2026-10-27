const { z } = require('zod');
const { id, idParams, dateTime } = require('./common');
const { DATE_ONLY, DAY_MS, puneStartOfDay } = require('../utils/puneTime');

const CATEGORIES = ['tech', 'music', 'sports', 'food', 'workshop'];
const MAX_PRICE = 99999999.99; // NUMERIC(10,2)
const MAX_CAPACITY = 100000;

const category = z.enum(CATEGORIES);

// Rupees with at most two decimal places. Compared with a tolerance because
// 19.99 * 100 isn't exactly 1999 in floating point.
const price = z
  .number()
  .min(0)
  .max(MAX_PRICE)
  .refine((p) => Math.abs(p * 100 - Math.round(p * 100)) < 1e-6, 'Price can have at most 2 decimal places');

const futureDateTime = dateTime.refine((d) => d.getTime() > Date.now(), 'Must be in the future');

// ---------------------------------------------------------------------------
// GET /events query
// ---------------------------------------------------------------------------

// `from` / `to` accept either a full datetime or a plain date. A plain date
// means that whole day in Pune time, so to=2026-11-05 includes events on the 5th.
function dateBound(kind) {
  return z
    .string()
    .trim()
    .transform((s, ctx) => {
      if (DATE_ONLY.test(s)) {
        const start = puneStartOfDay(s);
        if (!start) {
          ctx.addIssue({ code: 'custom', message: 'Not a valid calendar date' });
          return z.NEVER;
        }
        return kind === 'from'
          ? { at: start, inclusive: true }
          : { at: new Date(start.getTime() + DAY_MS), inclusive: false };
      }
      const parsed = z.iso.datetime({ offset: true }).safeParse(s);
      if (!parsed.success) {
        ctx.addIssue({ code: 'custom', message: 'Must be YYYY-MM-DD or an ISO 8601 datetime with a time zone' });
        return z.NEVER;
      }
      return { at: new Date(s), inclusive: true };
    });
}

// Filters shared by GET /events and GET /volunteer-opportunities.
const listFilterFields = {
  category: category.optional(),
  area: z.string().trim().min(1).max(100).optional(),
  from: dateBound('from').optional(),
  to: dateBound('to').optional(),
  q: z.string().trim().min(1).max(100).optional(),
  page: z.coerce.number().int().min(1).max(10000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
};

const fromBeforeTo = [
  (q) => !q.from || !q.to || q.from.at < q.to.at,
  { message: '`from` must be before `to`', path: ['to'] },
];

const listQuery = z
  .object({
    ...listFilterFields,
    // z.coerce.boolean() would turn the string "false" into true.
    free: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
  })
  .refine(...fromBeforeTo);

// ---------------------------------------------------------------------------
// POST / PATCH /events body
// ---------------------------------------------------------------------------

const fields = {
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().max(5000).nullable(),
  category,
  venueId: id.nullable(),
  startsAt: futureDateTime,
  endsAt: dateTime.nullable(),
  capacity: z.number().int().min(1).max(MAX_CAPACITY),
  price,
  // Cancelling goes through DELETE, so it isn't settable here.
  status: z.enum(['draft', 'published']),
};

const endsAfterStart = [
  (e) => !e.endsAt || !e.startsAt || e.endsAt > e.startsAt,
  { message: '`endsAt` must be after `startsAt`', path: ['endsAt'] },
];

const createBody = z
  .object({
    ...fields,
    description: fields.description.optional(),
    venueId: fields.venueId.optional(),
    endsAt: fields.endsAt.optional(),
    price: fields.price.default(0),
    status: fields.status.default('published'),
  })
  .refine(...endsAfterStart);

const updateBody = z
  .object(fields)
  .partial()
  .refine((b) => Object.keys(b).length > 0, 'Provide at least one field to update')
  .refine(...endsAfterStart);

module.exports = {
  CATEGORIES,
  listFilterFields,
  fromBeforeTo,
  list: { query: listQuery },
  getById: { params: idParams },
  create: { body: createBody },
  update: { params: idParams, body: updateBody },
  remove: { params: idParams },
};
