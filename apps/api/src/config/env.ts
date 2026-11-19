import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  HOST: z.string().min(1).default('0.0.0.0'),
  CORS_ORIGIN: z.string().min(1).default('http://localhost:5173'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // --- Authentication / sessions -----------------------------------------
  // Signs the CSRF double-submit token (see src/middleware/csrf.ts) — not a
  // password-hashing secret, just needs to be long and unpredictable.
  // Required (no insecure default) since it's security-critical.
  CSRF_SECRET: z
    .string()
    .min(32, 'CSRF_SECRET must be at least 32 characters — generate with `openssl rand -hex 32`'),
  SESSION_COOKIE_NAME: z.string().min(1).default('academy_session'),
  // Fixed absolute session lifetime from creation — see
  // docs/architecture/authentication.md ("Session lifecycle") for the
  // reasoning. Not a sliding/renewing expiry.
  SESSION_TTL_HOURS: z.coerce
    .number()
    .int()
    .positive()
    .default(24 * 30),
});

export type Env = z.infer<typeof EnvSchema>;

function loadEnv(source: NodeJS.ProcessEnv): Env {
  const result = EnvSchema.safeParse(source);

  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');

    console.error(`Invalid environment configuration:\n${issues}`);
    process.exit(1);
  }

  return result.data;
}

export const env = loadEnv(process.env);

export const corsOrigins = env.CORS_ORIGIN.split(',').map((origin) => origin.trim());

export const SESSION_TTL_MS = env.SESSION_TTL_HOURS * 60 * 60 * 1000;
