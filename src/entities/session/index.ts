import type { GreenApi } from '@/shared/api/green-api';

export interface Session {
  api: GreenApi;
  id: string;
  warning: string;
}
