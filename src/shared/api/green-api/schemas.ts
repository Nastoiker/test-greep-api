import { z } from 'zod';

export const credentialsSchema = z.object({
  idInstance: z.string().regex(/^\d+$/, 'ID инстанса должен содержать только цифры.'),
  apiTokenInstance: z
    .string()
    .regex(/^[a-zA-Z0-9_-]+$/, 'Проверьте токен: он не должен содержать пробелы.'),
  apiUrl: z.string(),
});
export type Credentials = z.infer<typeof credentialsSchema>;
const identifier = z.union([z.string(), z.number()]);
export const notificationBodySchema = z.object({
  typeWebhook: z.string(),
  idMessage: identifier.optional(),
  chatId: identifier.optional(),
  timestamp: z.number().finite().optional(),
  status: z.string().optional(),
  senderData: z
    .object({
      chatId: identifier.optional(),
      chatName: z.string().optional(),
      senderName: z.string().optional(),
    })
    .optional(),
  messageData: z
    .object({
      typeMessage: z.string(),
      textMessageData: z.object({ textMessage: z.string() }).optional(),
      extendedTextMessageData: z.object({ text: z.string() }).optional(),
    })
    .optional(),
});
export const notificationSchema = z.object({
  receiptId: z.number().int().nonnegative(),
  body: notificationBodySchema,
});
export const receiptSchema = z.object({ result: z.boolean(), reason: z.string().optional() });
export const stateSchema = z.object({ stateInstance: z.string() });
export const settingsSchema = z.object({
  webhookUrl: z.string().optional(),
  incomingWebhook: z.string().optional(),
});
export const accountSchema = z.object({
  exist: z.boolean().optional(),
  chatId: identifier.optional(),
  status: z.boolean().optional(),
});
export const sentSchema = z.object({ idMessage: identifier });
export type NotificationBody = z.infer<typeof notificationBodySchema>;
export type Notification = z.infer<typeof notificationSchema>;
export interface NotificationApi {
  receive: (signal?: AbortSignal) => Promise<Notification | null>;
  remove: (receiptId: number, signal?: AbortSignal) => Promise<z.infer<typeof receiptSchema>>;
}
