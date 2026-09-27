export const errorText = (error: unknown) =>
  error instanceof Error ? error.message : 'Не удалось выполнить запрос.';
