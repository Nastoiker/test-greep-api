import test from 'node:test';
import assert from 'node:assert/strict';
import { chatReducer, initialChatState } from '../src/pages/chat/model/chatState';

import type { ChatAction } from '../src/pages/chat/model/chatState';
import type { Message } from '../src/entities/chat';
const chat = { id: 'c1', name: 'Первый чат', messages: [] };
const reduce = (...actions: ChatAction[]) => actions.reduce(chatReducer, initialChatState);
const message: Message = {
  id: 'm1',
  text: 'Привет',
  direction: 'out',
  time: 100,
  status: 'queued',
};
const status = (value: string, chatId = 'c1'): ChatAction => ({
  type: 'notification',
  body: { typeWebhook: 'outgoingMessageStatus', chatId, idMessage: 'm1', status: value },
});

test('delivery status received before HTTP response survives reconciliation', () => {
  const state = reduce(
    { type: 'upsert', chat },
    status('read'),
    { type: 'sent', chatId: 'c1', message },
    status('delivered'),
  );
  assert.equal(state.chats[0]!.messages[0]!.status, 'read');
});
test('message IDs are scoped by chat when applying statuses', () => {
  const state = reduce(
    { type: 'upsert', chat },
    { type: 'sent', chatId: 'c1', message },
    { type: 'sent', chatId: 'c2', message },
    status('delivered'),
  );
  assert.equal(state.chats[0]!.messages[0]!.status, 'delivered');
  assert.equal(state.chats[1]!.messages[0]!.status, 'queued');
});
test('drafts and failed submissions remain independent between chats', () => {
  const state = reduce(
    { type: 'draft', chatId: 'c1', text: 'Первый черновик' },
    { type: 'draft', chatId: 'c2', text: 'Второй черновик' },
    { type: 'sending', chatId: 'c1' },
    { type: 'sendError', chatId: 'c1', error: 'offline' },
  );
  assert.equal(state.drafts.c1, 'Первый черновик');
  assert.equal(state.drafts.c2, 'Второй черновик');
  assert.equal(state.errors.c1, 'offline');
  assert.equal(state.errors.c2, undefined);
  assert.equal(state.sending.c1, false);
});
test('late success never clears a newer draft', () => {
  const state = reduce(
    { type: 'draft', chatId: 'c1', text: 'Новый текст' },
    { type: 'sent', chatId: 'c1', message },
  );
  assert.equal(state.drafts.c1, 'Новый текст');
});
test('successful send clears only its own draft', () => {
  const state = reduce(
    { type: 'draft', chatId: 'c1', text: ' Привет ' },
    { type: 'draft', chatId: 'c2', text: 'Другой текст' },
    { type: 'sent', chatId: 'c1', message },
  );
  assert.equal(state.drafts.c1, '');
  assert.equal(state.drafts.c2, 'Другой текст');
});
test('API echo and success response reconcile without duplicate or status downgrade', () => {
  const echo: ChatAction = {
    type: 'notification',
    body: {
      typeWebhook: 'outgoingAPIMessageReceived',
      idMessage: 'm1',
      timestamp: 1,
      senderData: { chatId: 'c1' },
      messageData: { typeMessage: 'textMessage', textMessageData: { textMessage: 'Привет' } },
    },
  };
  const state = reduce(echo, status('delivered'), { type: 'sent', chatId: 'c1', message }, echo);
  assert.equal(state.chats[0]!.messages.length, 1);
  assert.equal(state.chats[0]!.messages[0]!.status, 'delivered');
});
test('orphan status cache is bounded', () => {
  const actions = Array.from({ length: 600 }, (_, i) => status('read', `chat-${i}`));
  assert.equal(Object.keys(reduce(...actions).statuses).length, 500);
});
