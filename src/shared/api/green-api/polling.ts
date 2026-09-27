import type { NotificationApi, NotificationBody, Notification } from './schemas';
import { config } from '@/shared/config';
import { errorText } from '@/shared/lib/errors';
import { ApiError } from './client';
function wait(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve) => {
    const finish = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', finish);
      resolve();
    };
    const timer = setTimeout(finish, ms);
    signal.addEventListener('abort', finish, { once: true });
    if (signal.aborted) finish();
  });
}

// Не читаем следующее уведомление, пока не подтвердили текущее.
export async function pollNotifications(
  api: NotificationApi,
  {
    signal,
    onMessage,
    onStatus,
  }: {
    signal: AbortSignal;
    onMessage: (body: NotificationBody) => void | Promise<void>;
    onStatus: (message: string) => void;
  },
): Promise<void> {
  let pending: Notification | null = null;
  let delay = config.retryInitialMs;
  while (!signal.aborted) {
    try {
      if (!pending) {
        const notification = await api.receive(signal);
        if (signal.aborted) return;
        if (notification) {
          if (notification.receiptId == null || !notification.body)
            throw new Error('Некорректное уведомление GREEN-API.');
          await onMessage(notification.body);
          if (signal.aborted) return;
          pending = notification;
        }
      }
      if (pending) {
        const result = await api.remove(pending.receiptId, signal);
        if (typeof result?.result !== 'boolean')
          throw new Error('Не удалось подтвердить получение сообщения.');
        // false: уведомление уже удалено или receiptId устарел. Читаем очередь заново.
        pending = null;
      }
      if (signal.aborted) return;
      onStatus('');
      delay = config.retryInitialMs;
      await wait(config.pollIntervalMs, signal);
    } catch (error) {
      if (signal.aborted) return;
      onStatus(errorText(error));
      if (error instanceof ApiError && [401, 403].includes(error.status ?? 0)) return;
      await wait(delay, signal);
      delay = Math.min(delay * 2, config.retryMaxMs);
    }
  }
}
