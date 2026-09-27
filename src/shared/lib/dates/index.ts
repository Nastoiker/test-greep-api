export const time = (value: number) =>
  new Date(value).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
export const date = (value: number) =>
  new Date(value).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
