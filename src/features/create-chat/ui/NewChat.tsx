import { useRef, useState } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  TextField,
} from '@mui/material';
import { useMutation } from '@tanstack/react-query';
import { ArrowRight, X } from 'lucide-react';
import { normalizePhone } from '@/entities/chat';
import { errorText } from '@/shared/lib/errors';
import type { FormEvent } from 'react';
import type { GreenApi } from '@/shared/api/green-api';
import type { Chat } from '@/entities/chat';
interface Props {
  api: GreenApi;
  chats: Chat[];
  onClose: () => void;
  onCreate: (chat: Chat) => void;
  getSignal: () => AbortSignal;
}
export default function NewChat({ api, chats, onClose, onCreate, getSignal }: Props) {
  const [phone, setPhone] = useState('');
  const phoneInput = useRef<HTMLInputElement>(null);
  const checkAccount = useMutation({
    mutationFn: ({ phone, signal }: { phone: string; signal: AbortSignal }) =>
      api.check(phone, signal),
  });
  const busy = checkAccount.isPending;
  const [error, setError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const signal = getSignal();
    setError('');
    try {
      const normalized = normalizePhone(phone);
      const existing = chats.find((chat) => chat.phone === normalized);
      if (existing) {
        onCreate(existing);
        return;
      }
      const result = await checkAccount.mutateAsync({ phone: normalized, signal });
      if (signal.aborted) return;
      if (result?.status === false)
        throw new Error(
          'Не удалось проверить номер. Проверьте состояние инстанса или повторите позже.',
        );
      if (!result?.exist || !result.chatId)
        throw new Error(
          'Аккаунт MAX не найден. Проверьте номер и доступность поиска по номеру у получателя.',
        );
      onCreate({
        id: String(result.chatId),
        phone: normalized,
        name: `+${normalized}`,
        messages: [],
      });
    } catch (error) {
      if (!signal.aborted) setError(errorText(error));
    }
  }
  return (
    <Dialog
      open
      fullWidth
      maxWidth="xs"
      slotProps={{ transition: { onEntered: () => phoneInput.current?.focus() } }}
      onClose={() => {
        if (!busy) onClose();
      }}
      aria-labelledby="new-chat-title"
    >
      <DialogTitle
        id="new-chat-title"
        sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
      >
        Новый чат
        <IconButton onClick={onClose} disabled={busy} aria-label="Закрыть">
          <X size={22} />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Stack component="form" spacing={3} onSubmit={submit} sx={{ pt: 1, pb: 1 }}>
          <p className="muted">Введите номер телефона получателя.</p>
          <TextField
            label="Номер телефона"
            autoFocus
            inputRef={phoneInput}
            type="tel"
            placeholder="+7 999 123-45-67"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            disabled={busy}
            required
            helperText="Номер РФ или Беларуси, зарегистрированный в MAX."
          />
          {error && <Alert severity="error">{error}</Alert>}
          <Button
            type="submit"
            variant="outlined"
            disabled={busy}
            endIcon={<ArrowRight size={18} />}
          >
            {busy ? 'Проверяем номер…' : 'Создать чат'}
          </Button>
        </Stack>
      </DialogContent>
    </Dialog>
  );
}
