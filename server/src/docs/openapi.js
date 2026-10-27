// OpenAPI 3.0 description of the API, served at /api/docs (Swagger UI) and
// /api/docs.json. tests/docs.test.js fails if a route exists without an entry
// here or vice versa, so update this file whenever you add or change a route.
const CATEGORIES = ['tech', 'music', 'sports', 'food', 'workshop'];

const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const json = (schema, example) => ({
  content: { 'application/json': { schema, ...(example !== undefined && { example }) } },
});
const response = (description, schema, example) => ({ description, ...(schema && json(schema, example)) });
const errorResponse = (description, code, message) =>
  response(description, ref('Error'), { error: { code, message } });

const idParam = {
  name: 'id', in: 'path', required: true, description: 'Event id',
  schema: { type: 'integer', minimum: 1, maximum: 2147483647 },
};
const bearer = [{ bearerAuth: [] }];

// Reusable responses
const R = {
  validation: { $ref: '#/components/responses/ValidationError' },
  unauthorized: { $ref: '#/components/responses/Unauthorized' },
  forbidden: { $ref: '#/components/responses/Forbidden' },
  eventNotFound: { $ref: '#/components/responses/EventNotFound' },
  rateLimited: { $ref: '#/components/responses/RateLimited' },
};

const spec = {
  openapi: '3.0.3',
  info: {
    title: 'PuneBuzz API',
    version: '1.0.0',
    description: [
      'REST API for the Pune Events Board: discover events, RSVP, and get waitlisted automatically when an event is full.',
      '',
      '**Auth:** call `POST /auth/login`, then click **Authorize** and paste the `token`.',
      '',
      '**Errors** always look like `{ "error": { "code": "EVENT_FULL", "message": "..." } }`; validation errors add `details`.',
      '',
      '**Times** are ISO 8601 with a time zone. Plain dates in filters (`YYYY-MM-DD`) mean that whole day in Pune time (IST).',
    ].join('\n'),
  },
  servers: [{ url: '/api/v1' }],
  tags: [
    { name: 'Auth' },
    { name: 'Events' },
    { name: 'RSVP', description: 'Seats and waitlist. Each call is one transaction holding a row lock on the event.' },
    { name: 'Venues' },
    { name: 'Me' },
    { name: 'Health' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      Error: {
        type: 'object',
        required: ['error'],
        properties: {
          error: {
            type: 'object',
            required: ['code', 'message'],
            properties: {
              code: { type: 'string', example: 'EVENT_CLOSED' },
              message: { type: 'string', example: 'This event is no longer taking bookings' },
              details: {
                type: 'array',
                description: 'Only on VALIDATION_ERROR',
                items: {
                  type: 'object',
                  properties: { path: { type: 'string', example: 'body.email' }, message: { type: 'string' } },
                },
              },
            },
          },
        },
      },
      User: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 3 },
          name: { type: 'string', example: 'Sneha Patil' },
          email: { type: 'string', format: 'email', example: 'user@punebuzz.test' },
          role: { type: 'string', enum: ['user', 'organizer', 'admin'] },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      AuthResult: {
        type: 'object',
        properties: { user: ref('User'), token: { type: 'string', description: 'JWT, valid for 7 days' } },
      },
      Venue: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 3 },
          name: { type: 'string', example: 'Kothrud Community Auditorium' },
          area: { type: 'string', example: 'Kothrud' },
          address: { type: 'string', nullable: true },
          lat: { type: 'number', nullable: true, example: 18.5074 },
          lng: { type: 'number', nullable: true, example: 73.8077 },
        },
      },
      VenueInput: {
        type: 'object',
        required: ['name', 'area'],
        properties: {
          name: { type: 'string', minLength: 2, maxLength: 150 },
          area: { type: 'string', minLength: 2, maxLength: 100, example: 'Baner' },
          address: { type: 'string', maxLength: 500, nullable: true },
          lat: { type: 'number', minimum: -90, maximum: 90, nullable: true, description: 'Send with lng, or neither' },
          lng: { type: 'number', minimum: -180, maximum: 180, nullable: true },
        },
      },
      Event: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 9 },
          title: { type: 'string', example: 'Hindustani Classical Baithak' },
          description: { type: 'string', nullable: true },
          category: { type: 'string', enum: CATEGORIES },
          startsAt: { type: 'string', format: 'date-time' },
          endsAt: { type: 'string', format: 'date-time', nullable: true },
          capacity: { type: 'integer', example: 2 },
          seatsTaken: { type: 'integer', example: 2 },
          seatsLeft: { type: 'integer', example: 0 },
          price: { type: 'number', example: 0 },
          isFree: { type: 'boolean' },
          status: { type: 'string', enum: ['draft', 'published', 'cancelled'] },
          createdAt: { type: 'string', format: 'date-time' },
          organizer: { type: 'object', properties: { id: { type: 'integer' }, name: { type: 'string' } } },
          venue: { allOf: [ref('Venue')], nullable: true },
        },
      },
      MyStatus: {
        type: 'object',
        nullable: true,
        description: '`null` when no valid token was sent',
        properties: {
          status: { type: 'string', enum: ['none', 'confirmed', 'waitlisted'] },
          position: { type: 'integer', description: 'Only when waitlisted; 1 = next in line', example: 3 },
        },
      },
      EventDetail: {
        allOf: [
          ref('Event'),
          {
            type: 'object',
            properties: {
              waitlistCount: { type: 'integer', example: 4 },
              myStatus: ref('MyStatus'),
            },
          },
        ],
      },
      EventInput: {
        type: 'object',
        required: ['title', 'category', 'startsAt', 'capacity'],
        properties: {
          title: { type: 'string', minLength: 3, maxLength: 200 },
          description: { type: 'string', maxLength: 5000, nullable: true },
          category: { type: 'string', enum: CATEGORIES },
          venueId: { type: 'integer', nullable: true },
          startsAt: { type: 'string', format: 'date-time', description: 'Must be in the future and include a time zone', example: '2026-12-05T18:30:00+05:30' },
          endsAt: { type: 'string', format: 'date-time', nullable: true, description: 'After startsAt' },
          capacity: { type: 'integer', minimum: 1, maximum: 100000 },
          price: { type: 'number', minimum: 0, maximum: 99999999.99, default: 0, description: 'Rupees, up to 2 decimal places' },
          status: { type: 'string', enum: ['draft', 'published'], default: 'published' },
        },
      },
      EventUpdate: {
        type: 'object',
        minProperties: 1,
        description:
          'Any subset of EventInput fields. Capacity cannot drop below seatsTaken (409); raising it moves people off the waitlist, oldest first. Cancel with DELETE, not status.',
        properties: {
          title: { type: 'string', minLength: 3, maxLength: 200 },
          description: { type: 'string', maxLength: 5000, nullable: true },
          category: { type: 'string', enum: CATEGORIES },
          venueId: { type: 'integer', nullable: true },
          startsAt: { type: 'string', format: 'date-time' },
          endsAt: { type: 'string', format: 'date-time', nullable: true },
          capacity: { type: 'integer', minimum: 1, maximum: 100000 },
          price: { type: 'number', minimum: 0 },
          status: { type: 'string', enum: ['draft', 'published'] },
        },
      },
      EventPage: {
        type: 'object',
        properties: {
          data: { type: 'array', items: ref('Event') },
          page: { type: 'integer', example: 1 },
          limit: { type: 'integer', example: 20 },
          total: { type: 'integer', example: 30 },
        },
      },
      Attendee: {
        type: 'object',
        properties: {
          id: { type: 'integer' }, name: { type: 'string' }, email: { type: 'string' },
          rsvpAt: { type: 'string', format: 'date-time' },
        },
      },
      WaitlistEntry: {
        type: 'object',
        properties: {
          position: { type: 'integer', example: 1 },
          id: { type: 'integer' }, name: { type: 'string' }, email: { type: 'string' },
          joinedAt: { type: 'string', format: 'date-time' },
        },
      },
      MyEvents: {
        type: 'object',
        properties: {
          attending: { type: 'array', items: ref('Event') },
          waitlisted: {
            type: 'array',
            items: { allOf: [ref('Event'), { type: 'object', properties: { position: { type: 'integer' } } }] },
          },
          organizing: { type: 'array', items: ref('Event') },
        },
      },
    },
    responses: {
      ValidationError: response('Validation failed (`VALIDATION_ERROR`, with `details`)', ref('Error'), {
        error: { code: 'VALIDATION_ERROR', message: 'Request validation failed', details: [{ path: 'body.capacity', message: 'Too small: expected number to be >=1' }] },
      }),
      Unauthorized: errorResponse('Missing, invalid or expired token (`AUTH_REQUIRED`, `INVALID_TOKEN`, `TOKEN_EXPIRED`)', 'AUTH_REQUIRED', 'Authentication required'),
      Forbidden: errorResponse('Not allowed for this user (`FORBIDDEN`)', 'FORBIDDEN', 'You do not have permission to do this'),
      EventNotFound: errorResponse('No such event, or a draft you do not own (`EVENT_NOT_FOUND`)', 'EVENT_NOT_FOUND', 'Event not found'),
      RateLimited: {
        ...errorResponse('Too many requests (`RATE_LIMITED`); see the `Retry-After` header', 'RATE_LIMITED', 'Too many attempts, please try again later'),
        headers: { 'Retry-After': { schema: { type: 'integer' }, description: 'Seconds until you can retry' } },
      },
    },
  },
  paths: {
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Liveness + database check',
        description: '`clientIp` is your IP as the API sees it; use it to verify `TRUST_PROXY` after deploying.',
        responses: {
          200: response('API and database are up', { type: 'object' }, { status: 'ok', db: 'ok', clientIp: '203.0.113.7' }),
          503: errorResponse('Database unreachable', 'DB_UNAVAILABLE', 'Database is unreachable'),
        },
      },
    },

    '/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Create an account',
        description: 'Choose `role`: `user` (default, books seats) or `organizer` (can also create events). `admin` is never accepted (400). Rate limited per IP (`AUTH_REGISTER_MAX` per hour).',
        requestBody: {
          required: true,
          ...json({
            type: 'object',
            required: ['name', 'email', 'password'],
            properties: {
              name: { type: 'string', maxLength: 100 },
              email: { type: 'string', format: 'email', description: 'Trimmed and lowercased' },
              password: { type: 'string', minLength: 8, description: 'At most 72 bytes (bcrypt limit)' },
              role: { type: 'string', enum: ['user', 'organizer'], default: 'user', description: 'Account type' },
            },
          }, { name: 'Sneha Patil', email: 'sneha@example.com', password: 'correct-horse', role: 'user' }),
        },
        responses: {
          201: response('Account created', ref('AuthResult')),
          400: R.validation,
          409: errorResponse('Email already registered', 'EMAIL_TAKEN', 'An account with this email already exists'),
          429: R.rateLimited,
        },
      },
    },
    '/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Log in',
        description: 'Rate limited per IP: `AUTH_LOGIN_MAX` failed attempts per 15 minutes (successful logins do not count).',
        requestBody: {
          required: true,
          ...json({
            type: 'object',
            required: ['email', 'password'],
            properties: { email: { type: 'string', format: 'email' }, password: { type: 'string' } },
          }, { email: 'user@punebuzz.test', password: 'User1!password' }),
        },
        responses: {
          200: response('Logged in', ref('AuthResult')),
          400: R.validation,
          401: errorResponse('Wrong email or password (same response for both)', 'INVALID_CREDENTIALS', 'Invalid email or password'),
          429: R.rateLimited,
        },
      },
    },
    '/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'Current user',
        security: bearer,
        responses: {
          200: response('The logged-in user', { type: 'object', properties: { user: ref('User') } }),
          401: R.unauthorized,
        },
      },
    },

    '/events': {
      get: {
        tags: ['Events'],
        summary: 'List events',
        description: 'Only published events starting from now, soonest first, unless an explicit `from` is given.',
        parameters: [
          { name: 'category', in: 'query', schema: { type: 'string', enum: CATEGORIES } },
          { name: 'area', in: 'query', schema: { type: 'string' }, description: 'Venue area, case-insensitive, e.g. `Baner`' },
          { name: 'from', in: 'query', schema: { type: 'string' }, description: '`YYYY-MM-DD` (start of that day, IST) or ISO datetime' },
          { name: 'to', in: 'query', schema: { type: 'string' }, description: '`YYYY-MM-DD` (whole day, IST) or ISO datetime' },
          { name: 'q', in: 'query', schema: { type: 'string', maxLength: 100 }, description: 'Search title and description (case-insensitive)' },
          { name: 'free', in: 'query', schema: { type: 'string', enum: ['true', 'false'] } },
          { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } },
        ],
        responses: { 200: response('A page of events', ref('EventPage')), 400: R.validation },
      },
      post: {
        tags: ['Events'],
        summary: 'Create an event',
        description: 'Organizer or admin. The caller becomes the organizer.',
        security: bearer,
        requestBody: { required: true, ...json(ref('EventInput')) },
        responses: {
          201: response('Created', { type: 'object', properties: { event: ref('Event') } }),
          400: { description: 'Validation failed, or `INVALID_VENUE`', ...json(ref('Error')) },
          401: R.unauthorized,
          403: R.forbidden,
        },
      },
    },
    '/events/{id}': {
      parameters: [idParam],
      get: {
        tags: ['Events'],
        summary: 'Event detail',
        description: 'Public. Send a token to get `myStatus`; an invalid or expired token is treated as anonymous. Drafts are visible only to their organizer and admins.',
        security: [{}, { bearerAuth: [] }],
        responses: {
          200: response('The event', { type: 'object', properties: { event: ref('EventDetail') } }),
          400: R.validation,
          404: R.eventNotFound,
        },
      },
      patch: {
        tags: ['Events'],
        summary: 'Edit an event',
        description: 'Organizer of this event, or an admin. Runs under the same row lock as RSVPs.',
        security: bearer,
        requestBody: { required: true, ...json(ref('EventUpdate')) },
        responses: {
          200: response('Updated', { type: 'object', properties: { event: ref('Event') } }),
          400: { description: 'Validation failed, or `INVALID_VENUE`', ...json(ref('Error')) },
          401: R.unauthorized,
          403: R.forbidden,
          404: R.eventNotFound,
          409: response('`CAPACITY_BELOW_SEATS_TAKEN`, `EVENT_HAS_ATTENDEES` (unpublishing) or `EVENT_CANCELLED`', ref('Error'), {
            error: { code: 'CAPACITY_BELOW_SEATS_TAKEN', message: "Capacity can't be lower than the 6 seats already taken" },
          }),
        },
      },
      delete: {
        tags: ['Events'],
        summary: 'Cancel an event',
        description: 'Soft delete: sets status to `cancelled` and keeps RSVPs and waitlist as history.',
        security: bearer,
        responses: {
          200: response('Cancelled', { type: 'object', properties: { event: ref('Event') } }),
          401: R.unauthorized,
          403: R.forbidden,
          404: R.eventNotFound,
          409: errorResponse('Already cancelled', 'EVENT_CANCELLED', 'Event has been cancelled'),
        },
      },
    },
    '/events/{id}/rsvp': {
      parameters: [idParam],
      post: {
        tags: ['RSVP'],
        summary: 'RSVP (or join the waitlist if full)',
        description: 'Locks the event row (`SELECT ... FOR UPDATE`), so simultaneous requests for the last seat are served one at a time. Rate limited per user (`RSVP_MAX` RSVP/cancel actions per 10 minutes).',
        security: bearer,
        responses: {
          201: response('Confirmed or waitlisted', {
            oneOf: [
              { type: 'object', properties: { status: { type: 'string', enum: ['confirmed'] } } },
              { type: 'object', properties: { status: { type: 'string', enum: ['waitlisted'] }, position: { type: 'integer' } } },
            ],
          }, { status: 'waitlisted', position: 4 }),
          400: R.validation,
          401: R.unauthorized,
          404: R.eventNotFound,
          409: response('`ALREADY_JOINED`, or `EVENT_CLOSED` (cancelled, draft or already started)', ref('Error'), {
            error: { code: 'ALREADY_JOINED', message: "You've already booked a seat or joined the waitlist for this event" },
          }),
          429: R.rateLimited,
        },
      },
      delete: {
        tags: ['RSVP'],
        summary: 'Cancel your RSVP or leave the waitlist',
        description: 'Giving up a seat hands it to waitlist #1 (seat count unchanged), or frees it if nobody is waiting. Shares the per-user rate limit with POST.',
        security: bearer,
        responses: {
          200: response('Done', {
            type: 'object', properties: { status: { type: 'string', enum: ['cancelled', 'left_waitlist'] } },
          }, { status: 'cancelled' }),
          400: R.validation,
          401: R.unauthorized,
          404: response('`EVENT_NOT_FOUND`, or `NOT_JOINED` (nothing to cancel)', ref('Error'), {
            error: { code: 'NOT_JOINED', message: "You don't have a booking for this event" },
          }),
          429: R.rateLimited,
        },
      },
    },
    '/events/{id}/attendees': {
      parameters: [idParam],
      get: {
        tags: ['RSVP'],
        summary: 'Confirmed attendees and the waitlist',
        description: 'Organizer of this event, or an admin. Waitlist is in queue order.',
        security: bearer,
        responses: {
          200: response('Attendees', {
            type: 'object',
            properties: {
              confirmed: { type: 'array', items: ref('Attendee') },
              waitlist: { type: 'array', items: ref('WaitlistEntry') },
            },
          }),
          401: R.unauthorized,
          403: R.forbidden,
          404: R.eventNotFound,
        },
      },
    },

    '/venues': {
      get: {
        tags: ['Venues'],
        summary: 'List all venues',
        description: 'Unpaginated, ordered by area then name.',
        responses: { 200: response('Venues', { type: 'object', properties: { data: { type: 'array', items: ref('Venue') } } }) },
      },
      post: {
        tags: ['Venues'],
        summary: 'Add a venue',
        description: 'Organizer or admin.',
        security: bearer,
        requestBody: { required: true, ...json(ref('VenueInput')) },
        responses: {
          201: response('Created', { type: 'object', properties: { venue: ref('Venue') } }),
          400: R.validation,
          401: R.unauthorized,
          403: R.forbidden,
        },
      },
    },

    '/me/events': {
      get: {
        tags: ['Me'],
        summary: 'Your events',
        description: 'Everything you are attending, waitlisted for (with position) or organizing, including past and cancelled events. Unpaginated.',
        security: bearer,
        responses: { 200: response('Your events', ref('MyEvents')), 401: R.unauthorized },
      },
    },
  },
};

// Volunteer endpoints live in their own fragment.
const volunteer = require('./volunteer.openapi');
spec.tags.push(volunteer.tag);
Object.assign(spec.components.schemas, volunteer.schemas);
Object.assign(spec.paths, volunteer.paths);

module.exports = spec;
