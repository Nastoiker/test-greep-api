import test from 'node:test';
import assert from 'node:assert/strict';
import { QueryClient } from '@tanstack/react-query';
import { createApi, withQueryClient } from '../src/shared/api/green-api';

const credentials = {
  idInstance: '3100000001',
  apiTokenInstance: 'private-test-token',
  apiUrl: 'https://3100.api.green-api.com',
};

test('React Query deduplicates concurrent reads and keeps credentials out of cache keys', async (t) => {
  const client = new QueryClient();
  t.after(() => client.clear());
  let requests = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    requests++;
    return new Response(JSON.stringify({ stateInstance: 'authorized' }));
  });
  const api = withQueryClient(createApi(credentials), client);
  const [a, b] = await Promise.all([api.state(), api.state()]);
  assert.equal(requests, 1);
  assert.deepEqual(a, b);
  const keys = JSON.stringify(
    client
      .getQueryCache()
      .getAll()
      .map((query) => query.queryKey),
  );
  assert.ok(!keys.includes(credentials.apiTokenInstance));
  assert.ok(!keys.includes(credentials.idInstance));
});

test('separate logins cannot reuse another session query', async (t) => {
  const client = new QueryClient();
  t.after(() => client.clear());
  let requests = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    requests++;
    return new Response(JSON.stringify({ stateInstance: 'authorized' }));
  });
  const a = withQueryClient(createApi(credentials), client);
  const b = withQueryClient(createApi(credentials), client);
  await Promise.all([a.state(), b.state()]);
  assert.equal(requests, 2);
});

test('query read errors are not retried outside the sequential polling policy', async (t) => {
  const client = new QueryClient();
  t.after(() => client.clear());
  let requests = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    requests++;
    return new Response('', { status: 500 });
  });
  const api = withQueryClient(createApi(credentials), client);
  await assert.rejects(api.receive());
  assert.equal(requests, 1);
});

test('clearing the query client aborts an active network request', async (t) => {
  const client = new QueryClient();
  t.after(() => client.clear());
  let aborted = false;
  t.mock.method(
    globalThis,
    'fetch',
    (_url: string, options: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        options.signal?.addEventListener(
          'abort',
          () => {
            aborted = true;
            reject(new DOMException('Aborted', 'AbortError'));
          },
          { once: true },
        );
      }),
  );
  const api = withQueryClient(createApi(credentials), client);
  const pending = api.receive();
  const rejection = assert.rejects(pending);
  client.clear();
  await rejection;
  assert.ok(aborted);
  assert.equal(client.getQueryCache().getAll().length, 0);
});

test('new effect lifetime does not reuse an aborted request during StrictMode remount', async (t) => {
  const client = new QueryClient();
  t.after(() => client.clear());
  let requests = 0;
  t.mock.method(globalThis, 'fetch', (_url: string, options: RequestInit) => {
    if (++requests > 1) return Promise.resolve(new Response('null'));
    return new Promise<Response>((_resolve, reject) => {
      options.signal?.addEventListener(
        'abort',
        () => reject(new DOMException('Aborted', 'AbortError')),
        { once: true },
      );
    });
  });
  const api = withQueryClient(createApi(credentials), client);
  const first = new AbortController();
  const rejected = assert.rejects(api.receive(first.signal));
  first.abort();
  assert.equal(await api.receive(new AbortController().signal), null);
  await rejected;
  assert.equal(requests, 2);
});
