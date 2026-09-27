import { z } from 'zod';

const milliseconds = (fallback: number) =>
  z.coerce.number().int().min(1).max(300_000).default(fallback);
const envSchema = z
  .object({
    VITE_GREEN_API_URL: z
      .url()
      .refine((value) => {
        const url = new URL(value);
        return (
          url.protocol === 'https:' &&
          /^(?:[a-z0-9-]+\.)*green-api\.com$/.test(url.hostname) &&
          !url.port &&
          !url.username &&
          !url.password &&
          !url.search &&
          !url.hash &&
          url.pathname === '/'
        );
      }, 'Use an HTTPS GREEN-API origin without path or credentials')
      .default('https://3100.api.green-api.com'),
    VITE_REQUEST_TIMEOUT_MS: milliseconds(40_000),
    VITE_RECEIVE_TIMEOUT_SECONDS: z.coerce.number().int().min(5).max(60).default(25),
    VITE_POLL_INTERVAL_MS: milliseconds(350),
    VITE_RETRY_INITIAL_MS: milliseconds(1000),
    VITE_RETRY_MAX_MS: milliseconds(30_000),
  })
  .refine((env) => env.VITE_REQUEST_TIMEOUT_MS > env.VITE_RECEIVE_TIMEOUT_SECONDS * 1000, {
    message: 'Request timeout must exceed receive timeout',
    path: ['VITE_REQUEST_TIMEOUT_MS'],
  })
  .refine((env) => env.VITE_RETRY_MAX_MS >= env.VITE_RETRY_INITIAL_MS, {
    message: 'Maximum retry delay must be at least initial delay',
    path: ['VITE_RETRY_MAX_MS'],
  });

export function parseEnv(input: Record<string, unknown>) {
  const result = envSchema.safeParse(input);
  if (!result.success) {
    // Значения не выводим: в них могли случайно указать токен.
    throw new Error(
      `Invalid environment: ${result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')}`,
    );
  }
  const env = result.data;
  return Object.freeze({
    apiUrl: new URL(env.VITE_GREEN_API_URL).origin,
    requestTimeoutMs: env.VITE_REQUEST_TIMEOUT_MS,
    receiveTimeoutSeconds: env.VITE_RECEIVE_TIMEOUT_SECONDS,
    pollIntervalMs: env.VITE_POLL_INTERVAL_MS,
    retryInitialMs: env.VITE_RETRY_INITIAL_MS,
    retryMaxMs: env.VITE_RETRY_MAX_MS,
  });
}
