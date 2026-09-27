import { createApi, withQueryClient, type Credentials } from '@/shared/api/green-api';
import type { QueryClient } from '@tanstack/react-query';
import type { Session } from '@/entities/session';

export async function authenticate(
  credentials: Credentials,
  signal: AbortSignal,
  queryClient: QueryClient,
): Promise<Session> {
  const api = withQueryClient(createApi(credentials), queryClient);
  const state = await api.state(signal);
  if (state.stateInstance !== 'authorized') {
    throw new Error(
      'Инстанс не авторизован. Подключите MAX в личном кабинете GREEN-API и повторите вход.',
    );
  }
  const settings = await api.settings(signal);
  const warning =
    settings.webhookUrl || settings.incomingWebhook !== 'yes'
      ? 'Чтобы получать ответы, включите incomingWebhook и очистите webhookUrl в настройках GREEN-API.'
      : '';
  return { api, id: credentials.idInstance, warning };
}
