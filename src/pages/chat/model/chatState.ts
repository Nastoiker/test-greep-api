import { appendMessage, applyNotification, notificationMessage } from '@/entities/chat';

import type { Chat, Message } from '@/entities/chat';
import type { NotificationBody } from '@/shared/api/green-api';
export interface ChatState {
  chats: Chat[];
  drafts: Record<string, string | undefined>;
  sending: Record<string, boolean | undefined>;
  errors: Record<string, string | undefined>;
  statuses: Record<string, string | undefined>;
}
export type ChatAction =
  | { type: 'upsert'; chat: Chat }
  | { type: 'draft'; chatId: string; text: string }
  | { type: 'sending'; chatId: string }
  | { type: 'sendError'; chatId: string; error: string }
  | { type: 'sent'; chatId: string; message: Message }
  | { type: 'notification'; body: NotificationBody };
export const initialChatState: ChatState = {
  chats: [],
  drafts: {},
  sending: {},
  errors: {},
  statuses: {},
};
const statusKey = (chatId: string, messageId: string) =>
  JSON.stringify([String(chatId), String(messageId)]);
const ranks: Record<string, number> = { queued: 0, pending: 0, sent: 1, delivered: 2, read: 3 };

export function mergeStatus(previous: string | undefined, next: string | undefined) {
  if (!previous) return next;
  if (!next) return previous;
  if (['failed', 'noAccount', 'notInGroup'].includes(next)) return next;
  if (['failed', 'noAccount', 'notInGroup'].includes(previous)) return previous;
  return (ranks[next] ?? -1) >= (ranks[previous] ?? -1) ? next : previous;
}

function addMessage(state: ChatState, chatId: string, message: Message, name?: string) {
  const existing = state.chats
    .find((chat) => chat.id === chatId)
    ?.messages.find((item) => item.id === message.id);
  const status = mergeStatus(
    mergeStatus(existing?.status, message.status),
    state.statuses[statusKey(chatId, message.id)],
  );
  const chats = appendMessage(state.chats, chatId, { ...message, status }, name);
  return chats.map((chat) =>
    chat.id !== chatId
      ? chat
      : {
          ...chat,
          messages: chat.messages.map((item) =>
            item.id === message.id ? { ...item, status } : item,
          ),
        },
  );
}

export function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case 'upsert': {
      const chat = action.chat;
      return {
        ...state,
        chats: state.chats.some((item) => item.id === chat.id)
          ? state.chats.map((item) =>
              item.id === chat.id ? { ...item, phone: chat.phone || item.phone } : item,
            )
          : [...state.chats, chat],
      };
    }
    case 'draft':
      return { ...state, drafts: { ...state.drafts, [action.chatId]: action.text } };
    case 'sending':
      return {
        ...state,
        sending: { ...state.sending, [action.chatId]: true },
        errors: { ...state.errors, [action.chatId]: '' },
      };
    case 'sendError':
      return {
        ...state,
        sending: { ...state.sending, [action.chatId]: false },
        errors: { ...state.errors, [action.chatId]: action.error },
      };
    case 'sent':
      return {
        ...state,
        chats: addMessage(state, action.chatId, action.message),
        drafts: {
          ...state.drafts,
          [action.chatId]:
            (state.drafts[action.chatId] || '').trim() === action.message.text
              ? ''
              : state.drafts[action.chatId],
        },
        sending: { ...state.sending, [action.chatId]: false },
      };
    case 'notification': {
      const body = action.body;
      if (body?.typeWebhook === 'outgoingMessageStatus' && body.chatId && body.idMessage) {
        const key = statusKey(String(body.chatId), String(body.idMessage));
        const previous = state.chats
          .find((chat) => chat.id === String(body.chatId))
          ?.messages.find((message) => message.id === String(body.idMessage))?.status;
        const status = mergeStatus(mergeStatus(state.statuses[key], previous), body.status);
        // Статус может прийти раньше ответа sendMessage. Храним последние 500.
        const statuses = Object.fromEntries(
          [...Object.entries(state.statuses).filter(([id]) => id !== key), [key, status]].slice(
            -500,
          ),
        );
        return { ...state, statuses, chats: applyNotification(state.chats, { ...body, status }) };
      }
      const parsed = notificationMessage(body);
      return parsed
        ? { ...state, chats: addMessage(state, parsed.chatId, parsed.message, parsed.name) }
        : state;
    }
    default:
      return state;
  }
}
