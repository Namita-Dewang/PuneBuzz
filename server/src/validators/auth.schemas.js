const { z } = require('zod');

const email = z
  .string()
  .trim()
  .toLowerCase()
  .max(255)
  .pipe(z.email({ message: 'Invalid email address' }));

const registerBody = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  email,
  // bcrypt only uses the first 72 bytes; reject longer instead of silently truncating.
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .refine((p) => Buffer.byteLength(p, 'utf8') <= 72, 'Password must be at most 72 bytes'),
  // Self-service roles only. 'admin' is never accepted here; admins are made in the database.
  role: z
    .enum(['user', 'organizer'], { message: "Account type must be 'user' or 'organizer'" })
    .default('user'),
});

const loginBody = z.object({
  email,
  password: z.string().min(1, 'Password is required').max(1024),
});

module.exports = {
  register: { body: registerBody },
  login: { body: loginBody },
};
