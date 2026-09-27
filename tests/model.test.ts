import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePhone, applyNotification, appendMessage } from '../src/entities/chat';
import { createApi, validateCredentials, ApiError } from '../src/shared/api/green-api';
import { pollNotifications } from '../src/shared/api/green-api';

const credentials = {
  idInstance: '3100000001',
  apiTokenInstance: 'test-token',
  apiUrl: 'https://3100.api.green-api.com/',
};
const incoming = {
  typeWebhook: 'incomingMessageReceived',
  idMessage: 'm1',
  timestamp: 1700000000,
  senderData: { chatId: '12345', chatName: 'Собеседник' },
  messageData: { typeMessage: 'textMessage', textMessageData: { textMessage: 'Привет 👋' } },
};

test('phone formats: normalize RF/BY and reject malformed input', () => {
  assert.equal(normalizePhone('8 (999) 123-45-67'), '79991234567');
  assert.equal(normalizePhone('+375 29 123-45-67'), '375291234567');
  for (const phone of ['123', 'abc79991234567', '+799912345678', '+19991234567'])
    assert.throws(() => normalizePhone(phone));
});
test('credentials cannot redirect tokens to an unrelated host', () => {
  assert.equal(validateCredentials(credentials).apiUrl, 'https://3100.api.green-api.com');
  for (const apiUrl of [
    'http://3100.api.green-api.com',
    'https://green-api.com.evil.test',
    'https://evil.test',
    'https://3100.api.green-api.com/path',
    'https://user:pass@3100.api.green-api.com',
  ])
    assert.throws(() => validateCredentials({ ...credentials, apiUrl }));
});
test('incoming reply goes into the existing chat and duplicates are ignored', () => {
  const chats = [{ id: '12345', name: '+79991234567', messages: [] }];
  const next = applyNotification(applyNotification(chats, incoming), incoming);
  assert.equal(next.length, 1);
  assert.equal(next[0]!.messages.length, 1);
  assert.equal(next[0]!.messages[0]!.text, 'Привет 👋');
  assert.equal(chats[0]!.messages.length, 0);
});
test('extended text supported, media and service events skipped', () => {
  const extended = {
    ...incoming,
    messageData: {
      typeMessage: 'extendedTextMessage',
      extendedTextMessageData: { text: 'https://example.com' },
    },
  };
  assert.equal(applyNotification([], extended)[0]!.messages[0]!.text, 'https://example.com');
  assert.deepEqual(
    applyNotification([], { ...incoming, messageData: { typeMessage: 'imageMessage' } }),
    [],
  );
  assert.deepEqual(applyNotification([], { typeWebhook: 'stateInstanceChanged' }), []);
});
test('API echo does not duplicate sent messages; delivery status updates', () => {
  const chats = appendMessage([], '12345', { id: 'm1', text: 'Привет', direction: 'out', time: 1 });
  const echo = applyNotification(chats, { ...incoming, typeWebhook: 'outgoingAPIMessageReceived' });
  assert.equal(echo[0]!.messages.length, 1);
  assert.equal(
    applyNotification(echo, {
      typeWebhook: 'outgoingMessageStatus',
      idMessage: 'm1',
      status: 'delivered',
    })[0]!.messages[0]!.status,
    'delivered',
  );
});
test('API requests use exact verbs, fields and receipt URLs', async (t) => {
  const calls: { url: string; method?: string | undefined; body?: BodyInit | null | undefined }[] =
    [];
  t.mock.method(globalThis, 'fetch', async (url: string, options: RequestInit) => {
    calls.push({ url, ...options });
    return new Response(
      JSON.stringify(
        url.includes('/checkAccount/')
          ? { exist: true, chatId: '12345' }
          : url.includes('/sendMessage/')
            ? { idMessage: 'm1' }
            : url.includes('/receiveNotification/')
              ? null
              : { result: true },
      ),
    );
  });
  const api = createApi(credentials);
  await api.check('79991234567');
  await api.send('12345', 'Привет');
  await api.receive();
  await api.remove(77);
  assert.deepEqual(JSON.parse(String(calls[0]!.body)), { phoneNumber: 79991234567 });
  assert.deepEqual(JSON.parse(String(calls[1]!.body)), { chatId: '12345', message: 'Привет' });
  assert.equal(calls[1]!.method, 'POST');
  assert.match(calls[2]!.url, /receiveNotification\/test-token\?receiveTimeout=25$/);
  assert.equal(calls[3]!.method, 'DELETE');
  assert.match(calls[3]!.url, /deleteNotification\/test-token\/77$/);
});
test('poller handles before acknowledgement and retries acknowledgement without redelivery', async () => {
  const controller = new AbortController();
  const events: string[] = [];
  let attempts = 0;
  const api = {
    receive: async () => {
      events.push('receive');
      return { receiptId: 77, body: incoming };
    },
    remove: async (id: number) => {
      assert.equal(id, 77);
      events.push('delete');
      if (++attempts === 1) throw new Error('offline');
      controller.abort();
      return { result: true };
    },
  };
  await pollNotifications(api, {
    signal: controller.signal,
    onMessage: () => {
      events.push('message');
    },
    onStatus: () => {},
  });
  assert.deepEqual(events, ['receive', 'message', 'delete', 'delete']);
});
test('poller stops on authentication errors', async () => {
  let calls = 0;
  await pollNotifications(
    {
      receive: async () => {
        calls++;
        throw new ApiError('unauthorized', 401);
      },
      remove: async () => ({ result: true }),
    },
    {
      signal: new AbortController().signal,
      onMessage: () => {},
      onStatus: (message) => assert.equal(message, 'unauthorized'),
    },
  );
  assert.equal(calls, 1);
});
test('stale acknowledgement resumes queue instead of retrying forever', async () => {
  const controller = new AbortController();
  let receives = 0;
  await pollNotifications(
    {
      receive: async () => {
        if (++receives === 2) {
          controller.abort();
          return null;
        }
        return { receiptId: 77, body: incoming };
      },
      remove: async () => ({ result: false }),
    },
    { signal: controller.signal, onMessage: () => {}, onStatus: () => {} },
  );
  assert.equal(receives, 2);
});

test('notification is not deleted if async processing fails', async () => {
  const controller = new AbortController();
  let deleted = false;
  await pollNotifications(
    {
      receive: async () => ({ receiptId: 1, body: incoming }),
      remove: async () => {
        deleted = true;
        return { result: true };
      },
    },
    {
      signal: controller.signal,
      onMessage: async () => {
        throw new Error('processing failed');
      },
      onStatus: () => controller.abort(),
    },
  );
  assert.equal(deleted, false);
});

test('missing token and misplaced plus signs are rejected at the boundary', () => {
  assert.throws(() => validateCredentials({ ...credentials, apiTokenInstance: undefined }));
  for (const value of ['++79991234567', '7999+1234567']) assert.throws(() => normalizePhone(value));
});

test('body read failures are normalized without exposing the request URL', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => ({
    ok: true,
    text: async () => {
      throw new Error('https://server/secret-token');
    },
  }));
  await assert.rejects(createApi(credentials).state(), (error: unknown) => {
    assert.ok(error instanceof Error);
    assert.equal(error.name, 'ApiError');
    assert.ok(!error.message.includes('secret-token'));
    return true;
  });
});
