import test from 'node:test';
import assert from 'node:assert/strict';
import { parseEnv } from '../src/shared/config';
import { createApi } from '../src/shared/api/green-api';

test('environment is parsed as numbers and receives documented defaults', () => {
  const env = parseEnv({ VITE_RECEIVE_TIMEOUT_SECONDS: '10', VITE_REQUEST_TIMEOUT_MS: '12000' });
  assert.equal(env.receiveTimeoutSeconds, 10);
  assert.equal(env.requestTimeoutMs, 12000);
  assert.equal(env.apiUrl, 'https://3100.api.green-api.com');
  assert.ok(Object.isFrozen(env));
});

test('invalid environment fails early', () => {
  for (const input of [
    { VITE_GREEN_API_URL: 'https://evil.test' },
    { VITE_REQUEST_TIMEOUT_MS: 'not-a-number' },
    { VITE_POLL_INTERVAL_MS: '0' },
    { VITE_RECEIVE_TIMEOUT_SECONDS: '61' },
    { VITE_REQUEST_TIMEOUT_MS: '20000', VITE_RECEIVE_TIMEOUT_SECONDS: '25' },
    { VITE_RETRY_INITIAL_MS: '2000', VITE_RETRY_MAX_MS: '1000' },
  ])
    assert.throws(() => parseEnv(input), /Invalid environment/);
});

test('invalid URL error never prints user-supplied credentials', () => {
  assert.throws(
    () => parseEnv({ VITE_GREEN_API_URL: 'https://secret:password@evil.test' }),
    (error) => {
      assert.ok(error instanceof Error);
      assert.ok(!error.message.includes('password'));
      return true;
    },
  );
});

test('malformed successful API responses fail runtime validation', async (t) => {
  t.mock.method(
    globalThis,
    'fetch',
    async () => new Response(JSON.stringify({ idMessage: { invalid: true } })),
  );
  const api = createApi({
    idInstance: '3100000001',
    apiTokenInstance: 'test',
    apiUrl: 'https://3100.api.green-api.com',
  });
  await assert.rejects(api.send('1', 'Привет'), /неожиданном формате/);
});
