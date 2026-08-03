import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3001),
  MONGODB_URI: z.string().default('mongodb://localhost:27017/aed_inspection'),
  JWT_SECRET: z.string().min(32).default('change-me-in-production-use-long-secret-key!!'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  CV_SERVICE_URL: z.string().default('http://localhost:8001'),
  CV_WS_URL: z.string().default('ws://localhost:8001'),
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:3000')
    .transform((val) => val.split(',').map((o) => o.trim())),
  UPLOAD_DIR: z.string().default('/tmp/aed_uploads'),
  MAX_FILE_SIZE_MB: z.coerce.number().default(50),
  BCRYPT_ROUNDS: z.coerce.number().default(12),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900000),
  RATE_LIMIT_MAX: z.coerce.number().default(500),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.flatten());
  process.exit(1);
}

export const config = parsed.data;
export type Config = typeof config;
