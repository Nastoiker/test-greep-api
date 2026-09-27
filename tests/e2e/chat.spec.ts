import type { Page } from '@playwright/test';
import type { Notification } from '../../src/shared/api/green-api';
import { test, expect } from '@playwright/test';

async function mockApi(
  page: Page,
  { failSend = false, unauthorized = false, beforeSend = async () => {} } = {},
) {
  const queue: Notification[] = [];
  const sent: unknown[] = [];
  const deleted: (string | undefined)[] = [];
  await page.route('https://*.green-api.com/**', async (route) => {
    const url = route.request().url();
    const reply = (body: unknown, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (url.includes('/getStateInstance/'))
      return reply({ stateInstance: unauthorized ? 'notAuthorized' : 'authorized' });
    if (url.includes('/getSettings/')) return reply({ incomingWebhook: 'yes', webhookUrl: '' });
    if (url.includes('/checkAccount/'))
      return reply({
        exist: true,
        chatId:
          route.request().postDataJSON().phoneNumber === 79991234567 ? '10000000' : '20000000',
      });
    if (url.includes('/sendMessage/')) {
      sent.push(route.request().postDataJSON());
      await beforeSend();
      return failSend ? reply({}, 500) : reply({ idMessage: `out-${sent.length}` });
    }
    if (url.includes('/receiveNotification/')) {
      await new Promise<void>((resolve) => setTimeout(resolve, 100));
      return reply(queue[0] || null);
    }
    if (url.includes('/deleteNotification/')) {
      deleted.push(url.split('/').at(-1));
      queue.shift();
      return reply({ result: true });
    }
    throw new Error(`Unexpected API method: ${new URL(url).pathname.split('/')[2]}`);
  });
  return { queue, sent, deleted };
}
async function login(page: Page) {
  await page.goto('/');
  await page.getByLabel('ID инстанса', { exact: true }).fill('3100000001');
  await page.locator('input[name="apiTokenInstance"]').fill('test-token');
  await page.getByRole('button', { name: 'Войти в чат' }).click();
}
async function newChat(page: Page, phone = '+79991234567') {
  await page.getByRole('button', { name: 'Новый чат', exact: true }).click();
  await page.getByRole('textbox', { name: 'Номер телефона' }).fill(phone);
  await page.getByRole('dialog').getByRole('button', { name: 'Создать чат' }).click();
  await expect(page.getByRole('heading', { name: phone })).toBeVisible();
}
test('full workflow, deduplication, safe rendering and logout', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const api = await mockApi(page);
  await page.goto('/');
  await page.screenshot({ path: 'docs/screenshots/login.png', fullPage: true });
  await login(page);
  await page.screenshot({ path: 'docs/screenshots/empty.png', fullPage: true });
  await newChat(page);
  await page
    .getByRole('textbox', { name: 'Сообщение', exact: true })
    .fill('Привет! Проверяем связь 👋');
  await page.getByRole('button', { name: 'Отправить сообщение' }).click();
  await expect(page.getByRole('log').getByText('Привет! Проверяем связь 👋')).toBeVisible();
  expect(api.sent).toEqual([{ chatId: '10000000', message: 'Привет! Проверяем связь 👋' }]);
  const body = {
    typeWebhook: 'incomingMessageReceived',
    idMessage: 'in-1',
    timestamp: Date.now() / 1000,
    senderData: { chatId: '10000000', chatName: 'Собеседник' },
    messageData: {
      typeMessage: 'textMessage',
      textMessageData: { textMessage: 'Привет! Всё работает, сообщение получил.' },
    },
  };
  api.queue.push({ receiptId: 1, body }, { receiptId: 2, body });
  await expect(
    page.getByRole('log').getByText(body.messageData.textMessageData.textMessage),
  ).toHaveCount(1);
  await expect.poll(() => api.deleted.length).toBe(2);
  await expect(
    page.getByRole('log').getByText(body.messageData.textMessageData.textMessage),
  ).toHaveCount(1);
  await page.screenshot({ path: 'docs/screenshots/chat.png', fullPage: true });
  api.queue.push({
    receiptId: 3,
    body: {
      ...body,
      idMessage: 'in-2',
      messageData: {
        typeMessage: 'textMessage',
        textMessageData: { textMessage: '<img src=x onerror=alert(1)>' },
      },
    },
  });
  await expect(page.getByRole('log').getByText('<img src=x onerror=alert(1)>')).toBeVisible();
  await expect(page.getByRole('log').locator('img')).toHaveCount(0);
  expect(
    await page.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length })),
  ).toEqual({ local: 0, session: 0 });
  await page.getByRole('button', { name: 'Выйти', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Вход в чат' })).toBeVisible();
  expect(errors).toEqual([]);
});
test('failed send retains draft, empty messages cannot be sent', async ({ page }) => {
  await mockApi(page, { failSend: true });
  await login(page);
  await newChat(page);
  await expect(page.getByRole('button', { name: 'Отправить сообщение' })).toBeDisabled();
  await page
    .getByRole('textbox', { name: 'Сообщение', exact: true })
    .fill('Не потерять этот текст');
  await page.getByRole('button', { name: 'Отправить сообщение' }).click();
  await expect(page.getByRole('alert')).toContainText('Текст сохранён');
  await expect(page.getByRole('textbox', { name: 'Сообщение', exact: true })).toHaveValue(
    'Не потерять этот текст',
  );
  await expect(page.getByRole('log').getByText('Не потерять этот текст')).toHaveCount(0);
});
test('unauthorized instance stays on login', async ({ page }) => {
  await mockApi(page, { unauthorized: true });
  await login(page);
  await expect(page.getByRole('alert')).toContainText('Инстанс не авторизован');
  await expect(page.getByRole('button', { name: 'Войти в чат' })).toBeEnabled();
});
test('mobile navigation and no horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockApi(page);
  await login(page);
  await newChat(page);
  await expect(page.getByRole('textbox', { name: 'Сообщение', exact: true })).toBeVisible();
  await page.screenshot({ path: 'docs/screenshots/mobile.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Назад к чатам' }).click();
  await expect(page.getByRole('textbox', { name: 'Поиск чатов' })).toBeVisible();
});

test('draft and late send error survive switching between conversations', async ({ page }) => {
  let release: () => void = () => {
    throw new Error('Gate not initialized');
  };
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const api = await mockApi(page, { failSend: true, beforeSend: () => gate });
  await login(page);
  await newChat(page);
  await page.getByRole('textbox', { name: 'Сообщение', exact: true }).fill('Первый черновик');
  await page.getByRole('button', { name: 'Отправить сообщение' }).click();
  await expect.poll(() => api.sent.length).toBe(1);
  await newChat(page, '+79991234568');
  await page.getByRole('textbox', { name: 'Сообщение', exact: true }).fill('Второй черновик');
  release();
  await page
    .getByRole('navigation', { name: 'Чаты' })
    .getByRole('button', { name: /79991234567/ })
    .click();
  await expect(page.getByRole('alert')).toContainText('Текст сохранён');
  await expect(page.getByRole('textbox', { name: 'Сообщение', exact: true })).toHaveValue(
    'Первый черновик',
  );
  await page
    .getByRole('navigation', { name: 'Чаты' })
    .getByRole('button', { name: /79991234568/ })
    .click();
  await expect(page.getByRole('textbox', { name: 'Сообщение', exact: true })).toHaveValue(
    'Второй черновик',
  );
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('early read status survives late HTTP response and duplicate submit is blocked', async ({
  page,
}) => {
  let release: () => void = () => {
    throw new Error('Gate not initialized');
  };
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const api = await mockApi(page, { beforeSend: () => gate });
  await login(page);
  await newChat(page);
  await page
    .getByRole('textbox', { name: 'Сообщение', exact: true })
    .fill('Проверяем порядок событий');
  await page.getByRole('textbox', { name: 'Сообщение', exact: true }).press('Enter');
  await expect.poll(() => api.sent.length).toBe(1);
  await expect(page.getByRole('button', { name: 'Отправить сообщение' })).toBeDisabled();
  api.queue.push({
    receiptId: 88,
    body: {
      typeWebhook: 'outgoingMessageStatus',
      chatId: '10000000',
      idMessage: 'out-1',
      status: 'read',
    },
  });
  await expect.poll(() => api.deleted.length).toBe(1);
  release();
  await expect(page.getByRole('log').getByLabel('Прочитано')).toBeVisible();
  expect(api.sent.length).toBe(1);
});
