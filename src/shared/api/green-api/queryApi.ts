import type { QueryClient } from '@tanstack/react-query';
import type { GreenApi } from './client';

// Новый вход не должен использовать кэш предыдущей сессии.
export function withQueryClient(api: GreenApi, client: QueryClient): GreenApi {
  const sessionKey = crypto.randomUUID();
  const lifetimes = new WeakMap<AbortSignal, number>();
  let nextLifetime = 0;
  function read<T>(
    method: string,
    request: (signal: AbortSignal) => Promise<T>,
    signal?: AbortSignal,
    argument = '',
  ) {
    // В StrictMode новый эффект не должен получить отменённый запрос старого.
    if (signal && !lifetimes.has(signal)) lifetimes.set(signal, ++nextLifetime);
    const lifetime = signal ? lifetimes.get(signal) : 0;
    return client.fetchQuery({
      queryKey: ['green-api', sessionKey, method, argument, lifetime],
      queryFn: ({ signal: querySignal }) =>
        request(signal ? AbortSignal.any([signal, querySignal]) : querySignal),
      staleTime: 0,
      gcTime: 0,
      retry: false,
      networkMode: 'always',
      structuralSharing: false,
    });
  }
  return {
    ...api,
    state: (signal) => read('state', api.state, signal),
    settings: (signal) => read('settings', api.settings, signal),
    check: (phone, signal) =>
      read('account', (querySignal) => api.check(phone, querySignal), signal, phone),
    receive: (signal) => read('notification', api.receive, signal),
  };
}
