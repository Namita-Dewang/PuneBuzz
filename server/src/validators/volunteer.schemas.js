const { z } = require('zod');
const { idParams } = require('./common');
const { listFilterFields, fromBeforeTo } = require('./events.schemas');

const opportunitiesQuery = z.object(listFilterFields).refine(...fromBeforeTo);

const roleFields = {
  title: z.string().trim().min(2, 'Role title must be at least 2 characters').max(100, 'Role title must be at most 100 characters'),
  description: z.string().trim().max(1000, 'Description must be at most 1000 characters').nullable(),
  spots: z.number().int('Spots must be a whole number').min(1, 'At least 1 spot').max(1000, 'At most 1000 spots'),
};

const createRoleBody = z.object({ ...roleFields, description: roleFields.description.optional() });

const updateRoleBody = z
  .object(roleFields)
  .partial()
  .refine((b) => Object.keys(b).length > 0, 'Provide at least one field to update');

const optionalText = (max, label) =>
  z
    .string()
    .trim()
    .max(max, `${label} must be at most ${max} characters`)
    .transform((s) => s || null)
    .nullable()
    .optional();

// The five application questions.
const applyBody = z.object({
  // 1. Why are you excited to volunteer at this event?
  motivation: z
    .string()
    .trim()
    .min(20, 'Tell the organizer a little more (at least 20 characters)')
    .max(1000, 'Please keep it under 1000 characters'),
  // 2. Have you volunteered before? (+ optional details)
  volunteeredBefore: z.boolean({ message: 'Please answer yes or no' }),
  pastExperience: optionalText(1000, 'Past experience'),
  // 3. What skills or experience can you bring?
  skills: optionalText(1000, 'Skills'),
  // 4. How much of the event can you help with?
  availability: z.enum(['full', 'partial', 'setup'], { message: 'Choose how much of the event you can help with' }),
  // 5. A phone number the organizer can reach you on.
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9][0-9 ()-]{6,18}[0-9]$/, 'Enter a valid phone number, e.g. +91 98765 43210'),
});

const statusBody = z.object({
  status: z.enum(['pending', 'accepted', 'declined'], { message: "Status must be 'pending', 'accepted' or 'declined'" }),
});

module.exports = {
  opportunities: { query: opportunitiesQuery },
  eventRoles: { params: idParams },
  createRole: { params: idParams, body: createRoleBody },
  updateRole: { params: idParams, body: updateRoleBody },
  deleteRole: { params: idParams },
  apply: { params: idParams, body: applyBody },
  withdraw: { params: idParams },
  applications: { params: idParams },
  setStatus: { params: idParams, body: statusBody },
};
