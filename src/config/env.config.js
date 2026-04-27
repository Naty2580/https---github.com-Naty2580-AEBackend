import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

// Define the strict schema for environment variables
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().regex(/^\d+$/).transform(Number).default('3000'),
  
  // Database
  DATABASE_URL: z.url("DATABASE_URL must be a valid connection string"),
  TELEGRAM_BOT_TOKEN: z.string().min(20, "Valid Telegram Bot Token is required"),
  
  // Security
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES_IN: z.string().default('1d'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('15d'),

  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.string().regex(/^\d+$/).transform(Number).default('587'),
  SMTP_USER: z.string().min(1),
  SMTP_PASS: z.string().min(1),
  EMAIL_FROM: z.email(),
  
  // Financial & Third-Party APIs (Chapa, Telebirr, etc.)
  CHAPA_SECRET_KEY: z.string().min(1, "CHAPA_SECRET_KEY is required for payments"),
  CHAPA_WEBHOOK_SECRET: z.string().min(1, "CHAPA_WEBHOOK_SECRET is required"),
  
  // Redis / Queues (Required for 5-min Escrow Timeout & PostGIS)
  REDIS_URL: z.string().url("REDIS_URL must be a valid connection string").optional(),
});

// Validate process.env against the schema
const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('❌ Invalid environment variables:');
  parsedEnv.error.issues.forEach((issue) => {
    console.error(`   - ${issue.path.join('.')}: ${issue.message}`);
  });
  process.exit(1); // Fail fast
}

// Export the validated and strongly-typed configuration
const config = parsedEnv.data;

export default config;