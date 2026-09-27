import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { chatReducer, initialChatState } from './chatState';
import { pollNotifications } from '@/shared/api/green-api';
import { errorText } from '@/shared/lib/errors';

import type { GreenApi } from '@/shared/api/green-api';
export function useChatSession(api: GreenApi) {
  const { mutateAsync: sendMessage } = useMutation({
    mutationFn: ({ chatId, text, signal }: { chatId: string; text: string; signal: AbortSignal }) =>
      api.send(chatId, text, signal),
  });
  const [state, dispatch] = useReducer(chatReducer, initialChatState);
  const [pollError, setPollError] = useState('');
  const [retry, setRetry] = useState(0);
  const inFlight = useRef(new Map<string, symbol>());
  const lifecycle = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    lifecycle.current = controller;
    const requests = inFlight.current;
    return () => {
      controller.abort();
      requests.clear();
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void pollNotifications(api, {
      signal: controller.signal,
      onMessage: (body) => dispatch({ type: 'notification', body }),
      onStatus: setPollError,
    });
    return () => controller.abort();
  }, [api, retry]);

  const getSignal = useCallback(() => {
    if (!lifecycle.current) throw new Error('Сессия не запущена.');
    return lifecycle.current.signal;
  }, []);
  const send = useCallback(
    async (chatId: string, draft: string) => {
      const text = draft.trim();
      if (!text || text.length > 4000 || inFlight.current.has(chatId)) return;
      const signal = getSignal();
      if (signal.aborted) return;
      const requestId = Symbol();
      inFlight.current.set(chatId, requestId);
      dispatch({ type: 'sending', chatId });
      try {
        const result = await sendMessage({ chatId, text, signal });
        if (signal.aborted) return;
        if (!result?.idMessage) throw new Error('Сервер не подтвердил отправку сообщения.');
        dispatch({
          type: 'sent',
          chatId,
          message: {
            id: String(result.idMessage),
            text,
            direction: 'out',
            time: Date.now(),
            status: 'queued',
          },
        });
      } catch (error) {
        if (!signal.aborted)
          dispatch({
            type: 'sendError',
            chatId,
            error: `${errorText(error)} Текст сохранён. Если запрос прервался, проверьте доставку перед повторной отправкой.`,
          });
      } finally {
        if (inFlight.current.get(chatId) === requestId) inFlight.current.delete(chatId);
      }
    },
    [sendMessage, getSignal],
  );

  return {
    ...state,
    dispatch,
    send,
    getSignal,
    pollError,
    reconnect: () => {
      setPollError('');
      setRetry((value) => value + 1);
    },
  };
}
