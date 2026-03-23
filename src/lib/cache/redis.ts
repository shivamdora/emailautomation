import "server-only";
import { Redis } from "@upstash/redis";
import type { ZodType } from "zod";
import { env, isRedisCacheConfigured } from "@/lib/supabase/env";

type CacheMode = "off" | "shadow" | "live";

type CacheEnvelope<T> = {
  version: number;
  cachedAt: string;
  data: T;
};

const CACHE_ENVELOPE_VERSION = 1;
const REDIS_OPERATION_TIMEOUT_MS = 1000;
const MAX_CACHE_PAYLOAD_BYTES = 256_000;

let redisClientSingleton: Redis | null | undefined;

function getConfiguredCacheMode(): CacheMode {
  if (!env.USE_REDIS_CACHE) {
    return "off";
  }

  return env.REDIS_CACHE_MODE;
}

export function getRedisCacheMode(): CacheMode {
  if (!isRedisCacheConfigured) {
    return "off";
  }

  return getConfiguredCacheMode();
}

function getRedisClient() {
  if (!isRedisCacheConfigured) {
    return null;
  }

  if (redisClientSingleton !== undefined) {
    return redisClientSingleton;
  }

  redisClientSingleton = new Redis({
    url: env.UPSTASH_REDIS_REST_URL!,
    token: env.UPSTASH_REDIS_REST_TOKEN!,
  });

  return redisClientSingleton;
}

export function buildRedisCacheKey(key: string) {
  return `${env.REDIS_CACHE_PREFIX}:${key}`;
}

function logCacheEvent(event: string, payload: Record<string, unknown>) {
  console.info("[redis-cache]", event, payload);
}

function toComparableJson(value: unknown) {
  return JSON.stringify(value);
}

function withTimeout<T>(promise: Promise<T>, label: string, action: string) {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`Redis ${action} timed out for ${label}.`));
    }, REDIS_OPERATION_TIMEOUT_MS);
  });

  return Promise.race<T>([promise, timeoutPromise]).finally(() => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  });
}

export async function safeRedisGet(key: string, label: string) {
  const redis = getRedisClient();

  if (!redis) {
    return null;
  }

  try {
    return await withTimeout(redis.get(buildRedisCacheKey(key)), label, "get");
  } catch (error) {
    logCacheEvent("fallback", {
      label,
      action: "get",
      key,
      reason: error instanceof Error ? error.message : "Unknown Redis error",
    });
    return null;
  }
}

async function safeRedisSet(key: string, value: string, ttlSeconds: number, label: string) {
  const redis = getRedisClient();

  if (!redis) {
    return;
  }

  try {
    await withTimeout(
      redis.set(buildRedisCacheKey(key), value, { ex: ttlSeconds }),
      label,
      "set",
    );
  } catch (error) {
    logCacheEvent("fallback", {
      label,
      action: "set",
      key,
      reason: error instanceof Error ? error.message : "Unknown Redis error",
    });
  }
}

export async function safeRedisDelete(key: string, label: string) {
  const redis = getRedisClient();

  if (!redis) {
    return;
  }

  try {
    await withTimeout(redis.del(buildRedisCacheKey(key)), label, "delete");
  } catch (error) {
    logCacheEvent("fallback", {
      label,
      action: "delete",
      key,
      reason: error instanceof Error ? error.message : "Unknown Redis error",
    });
  }
}

export async function safeRedisIncrement(key: string, label: string) {
  const redis = getRedisClient();

  if (!redis) {
    return 0;
  }

  try {
    return await withTimeout(redis.incr(buildRedisCacheKey(key)), label, "incr");
  } catch (error) {
    logCacheEvent("fallback", {
      label,
      action: "incr",
      key,
      reason: error instanceof Error ? error.message : "Unknown Redis error",
    });
    return 0;
  }
}

function parseCachedEnvelope<T>(
  value: unknown,
  schema: ZodType<T>,
): CacheEnvelope<T> | null {
  const raw =
    typeof value === "string"
      ? JSON.parse(value)
      : value;

  if (!raw || typeof raw !== "object") {
    return null;
  }

  const payload = raw as Partial<CacheEnvelope<unknown>>;

  if (payload.version !== CACHE_ENVELOPE_VERSION || typeof payload.cachedAt !== "string") {
    return null;
  }

  const parsedData = schema.safeParse(payload.data);

  if (!parsedData.success) {
    return null;
  }

  return {
    version: CACHE_ENVELOPE_VERSION,
    cachedAt: payload.cachedAt,
    data: parsedData.data,
  };
}

async function readCachedValue<T>(key: string, schema: ZodType<T>, label: string) {
  const raw = await safeRedisGet(key, label);

  if (raw == null) {
    return null;
  }

  try {
    const parsed = parseCachedEnvelope(raw, schema);

    if (!parsed) {
      await safeRedisDelete(key, label);
      logCacheEvent("invalid", { label, key });
      return null;
    }

    return parsed;
  } catch (error) {
    await safeRedisDelete(key, label);
    logCacheEvent("invalid", {
      label,
      key,
      reason: error instanceof Error ? error.message : "Failed to parse cache payload",
    });
    return null;
  }
}

async function writeCachedValue<T>(key: string, value: T, ttlSeconds: number, label: string) {
  const payload = JSON.stringify({
    version: CACHE_ENVELOPE_VERSION,
    cachedAt: new Date().toISOString(),
    data: value,
  } satisfies CacheEnvelope<T>);

  if (Buffer.byteLength(payload, "utf8") > MAX_CACHE_PAYLOAD_BYTES) {
    logCacheEvent("skip", {
      label,
      key,
      reason: "payload-too-large",
      bytes: Buffer.byteLength(payload, "utf8"),
    });
    return;
  }

  await safeRedisSet(key, payload, ttlSeconds, label);
}

export async function readThroughJsonCache<T>(input: {
  key: string;
  label: string;
  ttlSeconds: number;
  schema: ZodType<T>;
  load: () => Promise<T>;
}) {
  const mode = getRedisCacheMode();

  if (mode === "off") {
    return input.schema.parse(await input.load());
  }

  if (mode === "live") {
    const cached = await readCachedValue(input.key, input.schema, input.label);

    if (cached) {
      logCacheEvent("hit", {
        label: input.label,
        key: input.key,
        mode,
      });
      return cached.data;
    }

    const fresh = input.schema.parse(await input.load());
    await writeCachedValue(input.key, fresh, input.ttlSeconds, input.label);
    logCacheEvent("miss", {
      label: input.label,
      key: input.key,
      mode,
    });
    return fresh;
  }

  const cached = await readCachedValue(input.key, input.schema, input.label);
  const fresh = input.schema.parse(await input.load());

  if (cached) {
    logCacheEvent("shadow", {
      label: input.label,
      key: input.key,
      match: toComparableJson(cached.data) === toComparableJson(fresh),
    });
  } else {
    logCacheEvent("shadow-miss", {
      label: input.label,
      key: input.key,
    });
  }

  await writeCachedValue(input.key, fresh, input.ttlSeconds, input.label);
  return fresh;
}
