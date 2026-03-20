import { z } from "zod";

const envSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  DATABASE_URL: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_OAUTH_REDIRECT_URI: z.string().optional(),
  HUBSPOT_CLIENT_ID: z.string().optional(),
  HUBSPOT_CLIENT_SECRET: z.string().optional(),
  HUBSPOT_OAUTH_REDIRECT_URI: z.string().optional(),
  SALESFORCE_CLIENT_ID: z.string().optional(),
  SALESFORCE_CLIENT_SECRET: z.string().optional(),
  SALESFORCE_OAUTH_REDIRECT_URI: z.string().optional(),
  SALESFORCE_AUTH_BASE_URL: z.string().url().optional(),
  TOKEN_ENCRYPTION_KEY: z.string().min(32).optional(),
  CUSTOM_CRM_API_KEYS: z.string().optional(),
  SHARED_WORKSPACE_NAME: z.string().optional(),
  SHARED_WORKSPACE_SLUG: z.string().optional(),
  DEFAULT_PER_USER_DAILY_CAP: z.coerce.number().default(50),
  DEFAULT_PER_MINUTE_THROTTLE: z.coerce.number().default(10),
  FOLLOW_UP_DELAY_DAYS: z.coerce.number().default(2),
  SEED_MONITOR_INTERVAL_MINUTES: z.coerce.number().default(30),
  SUPABASE_CRON_VERIFY_SECRET: z.string().optional(),
});

const rawEnv = {
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  DATABASE_URL: process.env.DATABASE_URL,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  GOOGLE_OAUTH_REDIRECT_URI: process.env.GOOGLE_OAUTH_REDIRECT_URI,
  HUBSPOT_CLIENT_ID: process.env.HUBSPOT_CLIENT_ID,
  HUBSPOT_CLIENT_SECRET: process.env.HUBSPOT_CLIENT_SECRET,
  HUBSPOT_OAUTH_REDIRECT_URI: process.env.HUBSPOT_OAUTH_REDIRECT_URI,
  SALESFORCE_CLIENT_ID: process.env.SALESFORCE_CLIENT_ID,
  SALESFORCE_CLIENT_SECRET: process.env.SALESFORCE_CLIENT_SECRET,
  SALESFORCE_OAUTH_REDIRECT_URI: process.env.SALESFORCE_OAUTH_REDIRECT_URI,
  SALESFORCE_AUTH_BASE_URL: process.env.SALESFORCE_AUTH_BASE_URL,
  TOKEN_ENCRYPTION_KEY: process.env.TOKEN_ENCRYPTION_KEY,
  CUSTOM_CRM_API_KEYS: process.env.CUSTOM_CRM_API_KEYS,
  SHARED_WORKSPACE_NAME: process.env.SHARED_WORKSPACE_NAME,
  SHARED_WORKSPACE_SLUG: process.env.SHARED_WORKSPACE_SLUG,
  DEFAULT_PER_USER_DAILY_CAP: process.env.DEFAULT_PER_USER_DAILY_CAP,
  DEFAULT_PER_MINUTE_THROTTLE: process.env.DEFAULT_PER_MINUTE_THROTTLE,
  FOLLOW_UP_DELAY_DAYS: process.env.FOLLOW_UP_DELAY_DAYS,
  SEED_MONITOR_INTERVAL_MINUTES: process.env.SEED_MONITOR_INTERVAL_MINUTES,
  SUPABASE_CRON_VERIFY_SECRET: process.env.SUPABASE_CRON_VERIFY_SECRET,
};

const parsed = envSchema.safeParse(rawEnv);

export const env = parsed.success
  ? parsed.data
  : {
      DEFAULT_PER_USER_DAILY_CAP: 50,
      DEFAULT_PER_MINUTE_THROTTLE: 10,
      FOLLOW_UP_DELAY_DAYS: 2,
      SEED_MONITOR_INTERVAL_MINUTES: 30,
    };

function isPlaceholderSecret(value?: string) {
  return Boolean(value && /^(your-|replace-me|changeme)/i.test(value));
}

export const isSupabaseConfigured = Boolean(
  env.NEXT_PUBLIC_SUPABASE_URL &&
    (env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) &&
    env.SUPABASE_SERVICE_ROLE_KEY &&
    !isPlaceholderSecret(env.SUPABASE_SERVICE_ROLE_KEY),
);

export const supabaseBrowserKey =
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const isGoogleConfigured = Boolean(
  env.GOOGLE_CLIENT_ID &&
    env.GOOGLE_CLIENT_SECRET &&
    env.TOKEN_ENCRYPTION_KEY,
);

export const isHubSpotConfigured = Boolean(
  env.HUBSPOT_CLIENT_ID &&
    env.HUBSPOT_CLIENT_SECRET &&
    env.HUBSPOT_OAUTH_REDIRECT_URI,
);

export const isSalesforceConfigured = Boolean(
  env.SALESFORCE_CLIENT_ID &&
    env.SALESFORCE_CLIENT_SECRET &&
    env.SALESFORCE_OAUTH_REDIRECT_URI,
);

export function requireSupabaseConfiguration() {
  if (!isSupabaseConfigured) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL, a Supabase browser key, and a real SUPABASE_SERVICE_ROLE_KEY.",
    );
  }
}

export function requireGoogleConfiguration() {
  if (!isGoogleConfigured) {
    throw new Error(
      "Google OAuth is not configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and TOKEN_ENCRYPTION_KEY.",
    );
  }
}
