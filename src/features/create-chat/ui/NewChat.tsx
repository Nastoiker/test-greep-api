import { useEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { ArrowRight, MessageCircle, X } from 'lucide-react';
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
  const checkAccount = useMutation({
    mutationFn: ({ phone, signal }: { phone: string; signal: AbortSignal }) =>
      api.check(phone, signal),
  });
  const busy = checkAccount.isPending;
  const [error, setError] = useState('');
  const dialog = useRef<HTMLDialogElement | null>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
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
    <dialog
      ref={dialog}
      className="new-chat"
      onCancel={(event) => {
        if (busy) event.preventDefault();
        else onClose();
      }}
      aria-labelledby="new-chat-title"
    >
      <div className="dialog-header">
        <div className="section-icon">
          <MessageCircle size={25} />
        </div>
        <button className="icon-button" onClick={onClose} disabled={busy} aria-label="Закрыть">
          <X size={22} />
        </button>
      </div>
      <h2 id="new-chat-title">Новый чат</h2>
      <p className="muted">Введите номер телефона получателя.</p>
      <form onSubmit={submit}>
        <label>
          Номер телефона
          <input
            autoFocus
            type="tel"
            placeholder="+7 999 123-45-67"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            disabled={busy}
            required
          />
          <span className="field-hint">Номер РФ или Беларуси, зарегистрированный в MAX.</span>
        </label>
        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}
        <button className="primary" disabled={busy}>
          {busy ? 'Проверяем номер…' : 'Создать чат'}
          <ArrowRight size={18} />
        </button>
      </form>
    </dialog>
  );
}
