import type { NotificationBody } from '@/shared/api/green-api';
import type { Chat, Message } from './types';
export function normalizePhone(value: string) {
  if (!/^\+?[\d\s()-]+$/.test(value.trim()))
    throw new Error('Введите номер телефона, например +7 999 123-45-67.');
  let phone = value.replace(/\D/g, '');
  if (phone.length === 11 && phone[0] === '8') phone = `7${phone.slice(1)}`;
  if (!/^(7\d{10}|375\d{9})$/.test(phone))
    throw new Error('Укажите номер РФ (+7) или Беларуси (+375) в международном формате.');
  return phone;
}

export function notificationMessage(
  body: NotificationBody,
): { chatId: string; name: string; message: Message } | null {
  const incoming = body?.typeWebhook === 'incomingMessageReceived';
  if (
    !incoming &&
    !['outgoingMessageReceived', 'outgoingAPIMessageReceived'].includes(body?.typeWebhook)
  )
    return null;
  const data = body.messageData;
  const text =
    data?.typeMessage === 'textMessage'
      ? data.textMessageData?.textMessage
      : data?.typeMessage === 'extendedTextMessage'
        ? data.extendedTextMessageData?.text
        : null;
  const chatId = body.senderData?.chatId;
  if (typeof text !== 'string' || !chatId || !body.idMessage) return null;
  return {
    chatId: String(chatId),
    name: body.senderData?.chatName || body.senderData?.senderName || String(chatId),
    message: {
      id: String(body.idMessage),
      text,
      direction: incoming ? 'in' : 'out',
      time: (body.timestamp || Date.now() / 1000) * 1000,
      status: incoming ? undefined : 'sent',
    },
  };
}

// Уведомление может повториться; отправленное через API сообщение тоже приходит в очередь.
export function appendMessage(
  chats: Chat[],
  chatId: string,
  message: Message,
  name = chatId,
): Chat[] {
  const existing = chats.find((chat) => chat.id === chatId);
  if (!existing) return [...chats, { id: chatId, name, messages: [message] }];
  return chats.map((chat) =>
    chat.id !== chatId || chat.messages.some((item) => item.id === message.id)
      ? chat
      : { ...chat, messages: [...chat.messages, message].sort((a, b) => a.time - b.time) },
  );
}

export function applyNotification(chats: Chat[], body: NotificationBody): Chat[] {
  if (body?.typeWebhook === 'outgoingMessageStatus') {
    return chats.map((chat) => ({
      ...chat,
      messages: chat.messages.map((message) =>
        message.id === String(body.idMessage) && (!body.chatId || chat.id === String(body.chatId))
          ? { ...message, status: body.status }
          : message,
      ),
    }));
  }
  const parsed = notificationMessage(body);
  return parsed ? appendMessage(chats, parsed.chatId, parsed.message, parsed.name) : chats;
}
