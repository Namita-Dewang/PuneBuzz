// OpenAPI fragment for the volunteer endpoints; merged into openapi.js.
const CATEGORIES = ['tech', 'music', 'sports', 'food', 'workshop'];
const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const R = (name) => ({ $ref: `#/components/responses/${name}` });
const json = (schema, example) => ({ content: { 'application/json': { schema, ...(example !== undefined && { example }) } } });
const err = (description, code, message) => ({ description, ...json(ref('Error'), { error: { code, message } }) });
const idParam = (description) => ({ name: 'id', in: 'path', required: true, description, schema: { type: 'integer', minimum: 1 } });
const bearer = [{ bearerAuth: [] }];

const STATUS = { type: 'string', enum: ['pending', 'accepted', 'declined'], description: 'pending · accepted (volunteering) · declined (not selected)' };

const schemas = {
  VolunteerRole: {
    type: 'object',
    properties: {
      id: { type: 'integer' },
      title: { type: 'string', example: 'Registration desk' },
      description: { type: 'string', nullable: true },
      spots: { type: 'integer', example: 3 },
      spotsFilled: { type: 'integer', description: 'Accepted volunteers', example: 1 },
      spotsLeft: { type: 'integer', example: 2 },
      myStatus: { ...STATUS, nullable: true, description: 'Only when logged in; null if you have not applied' },
    },
  },
  VolunteerRoleInput: {
    type: 'object',
    required: ['title', 'spots'],
    properties: {
      title: { type: 'string', minLength: 2, maxLength: 100 },
      description: { type: 'string', maxLength: 1000, nullable: true },
      spots: { type: 'integer', minimum: 1, maximum: 1000 },
    },
  },
  VolunteerOpportunity: {
    type: 'object',
    properties: {
      id: { type: 'integer' },
      title: { type: 'string' },
      startsAt: { type: 'string', format: 'date-time' },
      category: { type: 'string', enum: CATEGORIES },
      venue: { type: 'object', nullable: true, properties: { name: { type: 'string' }, area: { type: 'string' } } },
      roles: {
        type: 'array',
        description: 'Roles with spots left, plus any role you have applied to',
        items: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            title: { type: 'string' },
            description: { type: 'string', nullable: true },
            spots: { type: 'integer' },
            spotsLeft: { type: 'integer' },
            myStatus: { ...STATUS, nullable: true, description: 'Only when logged in' },
          },
        },
      },
    },
  },
  VolunteerApplicationInput: {
    type: 'object',
    description: 'Answers to the five application questions',
    required: ['motivation', 'volunteeredBefore', 'availability', 'phone'],
    properties: {
      motivation: { type: 'string', minLength: 20, maxLength: 1000, description: '1. Why are you excited to volunteer at this event?' },
      volunteeredBefore: { type: 'boolean', description: '2. Have you volunteered before?' },
      pastExperience: { type: 'string', maxLength: 1000, nullable: true, description: '2b. Tell us about it (optional)' },
      skills: { type: 'string', maxLength: 1000, nullable: true, description: '3. What skills or experience can you bring? (optional)' },
      availability: { type: 'string', enum: ['full', 'partial', 'setup'], description: '4. How much of the event can you help with?' },
      phone: { type: 'string', example: '+91 98765 43210', description: '5. Phone number (shown only to the organizer)' },
    },
  },
  VolunteerApplication: {
    type: 'object',
    properties: {
      id: { type: 'integer' },
      status: STATUS,
      createdAt: { type: 'string', format: 'date-time' },
      decidedAt: { type: 'string', format: 'date-time', nullable: true },
      user: { type: 'object', properties: { id: { type: 'integer' }, name: { type: 'string' }, email: { type: 'string' } } },
      answers: ref('VolunteerApplicationInput'),
    },
  },
};

const paths = {
  '/volunteer-opportunities': {
    get: {
      tags: ['Volunteer'],
      summary: 'Events looking for volunteers',
      description:
        'Published, upcoming events with at least one volunteer role that still has spots left (a spot is used when the organizer accepts someone). Excludes events you organize. One query: events joined to roles and aggregated per event.',
      security: [{}, { bearerAuth: [] }],
      parameters: [
        { name: 'category', in: 'query', schema: { type: 'string', enum: CATEGORIES } },
        { name: 'area', in: 'query', schema: { type: 'string' } },
        { name: 'from', in: 'query', schema: { type: 'string' }, description: '`YYYY-MM-DD` (IST) or ISO datetime' },
        { name: 'to', in: 'query', schema: { type: 'string' }, description: '`YYYY-MM-DD` (whole day, IST) or ISO datetime' },
        { name: 'q', in: 'query', schema: { type: 'string', maxLength: 100 } },
        { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
        { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } },
      ],
      responses: {
        200: {
          description: 'A page of events with open roles',
          ...json({
            type: 'object',
            properties: {
              data: { type: 'array', items: ref('VolunteerOpportunity') },
              page: { type: 'integer' }, limit: { type: 'integer' }, total: { type: 'integer' },
            },
          }),
        },
        400: R('ValidationError'),
      },
    },
  },
  '/events/{id}/volunteer-roles': {
    parameters: [idParam('Event id')],
    get: {
      tags: ['Volunteer'],
      summary: "An event's volunteer roles",
      description: 'Public. With a token, each role includes your `myStatus`. Drafts are visible only to their organizer.',
      security: [{}, { bearerAuth: [] }],
      responses: { 200: { description: 'Roles', ...json({ type: 'object', properties: { roles: { type: 'array', items: ref('VolunteerRole') } } }) }, 404: R('EventNotFound') },
    },
    post: {
      tags: ['Volunteer'],
      summary: 'Add a volunteer role',
      description: 'Organizer of this event, or an admin.',
      security: bearer,
      requestBody: { required: true, ...json(ref('VolunteerRoleInput')) },
      responses: {
        201: { description: 'Created', ...json({ type: 'object', properties: { role: ref('VolunteerRole') } }) },
        400: R('ValidationError'), 401: R('Unauthorized'), 403: R('Forbidden'), 404: R('EventNotFound'),
        409: err('Event cancelled', 'EVENT_CANCELLED', 'Event has been cancelled'),
      },
    },
  },
  '/events/{id}/volunteer-applications': {
    parameters: [idParam('Event id')],
    get: {
      tags: ['Volunteer'],
      summary: 'Review volunteer applications',
      description: 'Organizer of this event, or an admin. Every role, each with its applications and answers.',
      security: bearer,
      responses: {
        200: {
          description: 'Roles with applications',
          ...json({ type: 'object', properties: { roles: { type: 'array', items: { allOf: [ref('VolunteerRole'), { type: 'object', properties: { applications: { type: 'array', items: ref('VolunteerApplication') } } }] } } } }),
        },
        401: R('Unauthorized'), 403: R('Forbidden'), 404: R('EventNotFound'),
      },
    },
  },
  '/events/{id}/volunteer-applications/export': {
    parameters: [idParam('Event id')],
    get: {
      tags: ['Volunteer'],
      summary: 'Download applications as Excel',
      description: 'Organizer of this event, or an admin. An .xlsx with one row per application and all five answers. Answers are written as text, never formulas.',
      security: bearer,
      responses: {
        200: {
          description: 'Excel workbook',
          content: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': { schema: { type: 'string', format: 'binary' } } },
        },
        401: R('Unauthorized'), 403: R('Forbidden'), 404: R('EventNotFound'),
      },
    },
  },
  '/volunteer-roles/{id}': {
    parameters: [idParam('Role id')],
    patch: {
      tags: ['Volunteer'],
      summary: 'Edit a volunteer role',
      description: "Organizer only. Spots can't go below the number of accepted volunteers (409).",
      security: bearer,
      requestBody: { required: true, ...json({ ...ref('VolunteerRoleInput'), description: 'Any subset of the fields' }) },
      responses: {
        200: { description: 'Updated', ...json({ type: 'object', properties: { role: ref('VolunteerRole') } }) },
        400: R('ValidationError'), 401: R('Unauthorized'), 403: R('Forbidden'),
        404: err('No such role', 'ROLE_NOT_FOUND', 'Volunteer role not found'),
        409: err('Spots below accepted volunteers', 'SPOTS_BELOW_ACCEPTED', 'This role already has 2 accepted volunteers'),
      },
    },
    delete: {
      tags: ['Volunteer'],
      summary: 'Delete a volunteer role',
      description: 'Organizer only. Refused once anyone has applied, so applications are never silently lost.',
      security: bearer,
      responses: {
        204: { description: 'Deleted' }, 401: R('Unauthorized'), 403: R('Forbidden'),
        404: err('No such role', 'ROLE_NOT_FOUND', 'Volunteer role not found'),
        409: err('Has applications', 'ROLE_HAS_APPLICATIONS', "People have applied to this role, so it can't be deleted. Edit it instead."),
      },
    },
  },
  '/volunteer-roles/{id}/applications': {
    parameters: [idParam('Role id')],
    post: {
      tags: ['Volunteer'],
      summary: 'Apply to volunteer',
      description: 'Answers the five application questions. Applications start as `pending`; the organizer accepts or declines. Shares the per-user booking rate limit.',
      security: bearer,
      requestBody: { required: true, ...json(ref('VolunteerApplicationInput')) },
      responses: {
        201: { description: 'Applied', ...json({ type: 'object', properties: { application: { type: 'object', properties: { id: { type: 'integer' }, roleId: { type: 'integer' }, status: STATUS, createdAt: { type: 'string', format: 'date-time' } } } } }) },
        400: R('ValidationError'), 401: R('Unauthorized'),
        403: err('Your own event', 'FORBIDDEN', "You can't volunteer at your own event"),
        404: err('No such role', 'ROLE_NOT_FOUND', 'Volunteer role not found'),
        409: err('`ALREADY_APPLIED`, `ROLE_FULL` or `EVENT_CLOSED`', 'ALREADY_APPLIED', "You've already applied for this role"),
        429: R('RateLimited'),
      },
    },
  },
  '/volunteer-roles/{id}/applications/me': {
    parameters: [idParam('Role id')],
    delete: {
      tags: ['Volunteer'],
      summary: 'Withdraw your application',
      description: 'Withdrawing an accepted application frees its spot.',
      security: bearer,
      responses: {
        204: { description: 'Withdrawn' }, 401: R('Unauthorized'),
        404: err('Nothing to withdraw', 'NOT_APPLIED', "You haven't applied for this role"),
        429: R('RateLimited'),
      },
    },
  },
  '/volunteer-applications/{id}': {
    parameters: [idParam('Application id')],
    patch: {
      tags: ['Volunteer'],
      summary: 'Accept or decline a volunteer',
      description: 'Organizer only. Accepting takes a spot (409 `ROLE_FULL` if none left); moving an accepted application back frees it. Runs under a row lock on the role.',
      security: bearer,
      requestBody: { required: true, ...json({ type: 'object', required: ['status'], properties: { status: STATUS } }, { status: 'accepted' }) },
      responses: {
        200: { description: 'Updated', ...json({ type: 'object', properties: { application: ref('VolunteerApplication') } }) },
        400: R('ValidationError'), 401: R('Unauthorized'), 403: R('Forbidden'),
        404: err('No such application', 'APPLICATION_NOT_FOUND', 'Application not found'),
        409: err('No spots left', 'ROLE_FULL', 'All spots for this role are filled. Increase the spots or decline someone first.'),
      },
    },
  },
};

module.exports = { schemas, paths, tag: { name: 'Volunteer', description: 'Volunteer roles on events, applications and review.' } };
