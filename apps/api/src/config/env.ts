import { apiEnvSchema, type ApiEnv } from '@ruma/validation';

let cached: ApiEnv | null = null;

export function loadApiEnv(env: NodeJS.ProcessEnv = process.env): ApiEnv {
  if (cached) {
    return cached;
  }

  const parsed = apiEnvSchema.safeParse(env);
  if (!parsed.success) {
    const message = parsed.error.issues.map((issue) => issue.message).join('; ');
    throw new Error(`Invalid API environment: ${message}`);
  }

  cached = parsed.data;
  return cached;
}

/** Test helper — clears memoized env between cases. */
export function resetApiEnvCache() {
  cached = null;
}
