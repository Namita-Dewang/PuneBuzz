const path = require('path');
const dotenv = require('dotenv');
const { z } = require('zod');

dotenv.config({ path: path.resolve(__dirname, '../../.env'), quiet: true });

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(12),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  // Number of reverse proxies in front of the API (0 locally, 1 on Render/Railway).
  // Needed so req.ip, and therefore rate limiting, sees the real client IP.
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
  AUTH_LOGIN_MAX: z.coerce.number().int().positive().default(10),
  AUTH_REGISTER_MAX: z.coerce.number().int().positive().default(10),
  RSVP_MAX: z.coerce.number().int().positive().default(20),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
  console.error(`Invalid environment configuration:\n${issues}\nSee server/.env.example`);
  process.exit(1);
}

const env = {
  ...parsed.data,
  CORS_ORIGIN: parsed.data.CORS_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean),
};

module.exports = env;
