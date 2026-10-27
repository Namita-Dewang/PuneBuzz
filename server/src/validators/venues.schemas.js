const { z } = require('zod');

const createBody = z
  .object({
    name: z.string().trim().min(2, 'Venue name must be at least 2 characters').max(150, 'Venue name must be at most 150 characters'),
    area: z.string().trim().min(2, 'Area is required').max(100, 'Area must be at most 100 characters'),
    address: z.string().trim().max(500, 'Address must be at most 500 characters').nullable().optional(),
    lat: z.number().min(-90).max(90).nullable().optional(),
    lng: z.number().min(-180).max(180).nullable().optional(),
  })
  .refine((v) => (v.lat == null) === (v.lng == null), {
    message: 'Provide both `lat` and `lng`, or neither',
    path: ['lng'],
  });

module.exports = {
  create: { body: createBody },
};
