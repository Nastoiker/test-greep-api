import type { z } from 'zod';
import { config, parseEnv } from '@/shared/config';
import {
  credentialsSchema,
  stateSchema,
  settingsSchema,
  accountSchema,
  sentSchema,
  notificationSchema,
  receiptSchema,
  type Credentials,
} from './schemas';

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function validateCredentials(input: unknown): Credentials {
  const result = credentialsSchema.safeParse(input);
  if (!result.success) throw new Error('Проверьте ID инстанса, токен и адрес сервера.');
  try {
    const { apiUrl } = parseEnv({ VITE_GREEN_API_URL: result.data.apiUrl });
    return { ...result.data, apiUrl };
  } catch {
    throw new Error(
      'API URL должен быть HTTPS-адресом сервера green-api.com без пути и параметров.',
    );
  }
}

interface RequestOptions {
  verb?: 'GET' | 'POST' | 'DELETE';
  data?: unknown;
  suffix?: string;
  signal?: AbortSignal | undefined;
}

export function createApi(credentials: Credentials) {
  const { apiUrl, idInstance, apiTokenInstance } = validateCredentials(credentials);
  async function request<T>(
    method: string,
    schema: z.ZodType<T>,
    { verb = 'GET', data, suffix = '', signal }: RequestOptions = {},
  ): Promise<T> {
    const timeout = AbortSignal.timeout(config.requestTimeoutMs);
    const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
    let response: Response;
    let text = '';
    try {
      response = await fetch(
        `${apiUrl}/waInstance${idInstance}/${method}/${apiTokenInstance}${suffix}`,
        {
          method: verb,
          signal: combined,
          cache: 'no-store',
          credentials: 'omit',
          referrerPolicy: 'no-referrer',
          ...(data !== undefined
            ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }
            : {}),
        },
      );
      if (response.ok) text = await response.text();
    } catch (error) {
      if (signal?.aborted) throw error;
      throw new ApiError(
        timeout.aborted
          ? 'Сервер не ответил вовремя. Попробуйте ещё раз.'
          : 'Нет связи с GREEN-API. Проверьте интернет и API URL.',
      );
    }
    if (!response.ok) {
      const descriptions: Record<number, string> = {
        400: 'GREEN-API отклонил запрос. Проверьте введённые данные.',
        401: 'Неверный ID инстанса или токен.',
        403: 'Нет доступа к инстансу. Проверьте токен и состояние аккаунта.',
        404: 'Инстанс не найден. Проверьте ID и API URL.',
        429: 'Слишком много запросов. Подождите немного.',
        469: 'MAX временно ограничил проверку номеров. Попробуйте позже.',
      };
      throw new ApiError(
        descriptions[response.status] ?? `Ошибка GREEN-API (${response.status}). Попробуйте позже.`,
        response.status,
      );
    }
    let payload: unknown;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      throw new ApiError('Сервер вернул некорректный JSON.');
    }
    const result = schema.safeParse(payload);
    if (!result.success) throw new ApiError('Сервер вернул данные в неожиданном формате.');
    return result.data;
  }
  return {
    state: (signal?: AbortSignal) => request('getStateInstance', stateSchema, { signal }),
    settings: (signal?: AbortSignal) => request('getSettings', settingsSchema, { signal }),
    check: (phone: string, signal?: AbortSignal) =>
      request('checkAccount', accountSchema, {
        verb: 'POST',
        data: { phoneNumber: Number(phone) },
        signal,
      }),
    send: (chatId: string, message: string, signal?: AbortSignal) =>
      request('sendMessage', sentSchema, { verb: 'POST', data: { chatId, message }, signal }),
    receive: (signal?: AbortSignal) =>
      request('receiveNotification', notificationSchema.nullable(), {
        suffix: `?receiveTimeout=${config.receiveTimeoutSeconds}`,
        signal,
      }),
    remove: (receiptId: number, signal?: AbortSignal) =>
      request('deleteNotification', receiptSchema, {
        verb: 'DELETE',
        suffix: `/${encodeURIComponent(receiptId)}`,
        signal,
      }),
  };
}
export type GreenApi = ReturnType<typeof createApi>;
