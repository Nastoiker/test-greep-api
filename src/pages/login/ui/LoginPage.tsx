import { useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Credentials } from '@/shared/api/green-api';
import {
  ArrowRight,
  CheckCheck,
  CircleAlert,
  Eye,
  EyeOff,
  MessageCircle,
  ShieldCheck,
} from 'lucide-react';
import { authenticate } from '@/features/authenticate';
import { config } from '@/shared/config';
import type { Session } from '@/entities/session';
import type { FormEvent } from 'react';
import { errorText } from '@/shared/lib/errors';
import Logo from '@/shared/ui/logo';
export default function Login({ onLogin }: { onLogin: (session: Session) => void }) {
  const [showToken, setShowToken] = useState(false);
  const queryClient = useQueryClient();
  const login = useMutation({
    mutationFn: ({ credentials, signal }: { credentials: Credentials; signal: AbortSignal }) =>
      authenticate(credentials, signal, queryClient),
  });
  const busy = login.isPending;
  const error = login.error ? errorText(login.error) : '';
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    controller.current = new AbortController();
    try {
      const credentials = {
        idInstance: String(form.get('idInstance') ?? '').trim(),
        apiTokenInstance: String(form.get('apiTokenInstance') ?? '').trim(),
        apiUrl: String(form.get('apiUrl') ?? '').trim(),
      };
      const session = await login.mutateAsync({ credentials, signal: controller.current.signal });
      if (!controller.current.signal.aborted) onLogin(session);
    } catch {
      // Ошибка отображается из login.error.
    }
  }
  return (
    <main className="login-page">
      <section className="intro">
        <Logo />
        <div className="intro-copy">
          <h1>
            Чат MAX
            <br />в браузере
          </h1>
          <p>
            Войдите с данными GREEN-API, добавьте собеседника по номеру телефона и напишите
            сообщение.
          </p>
          <div className="chat-art" aria-hidden="true">
            <div className="art-label">
              <span className="online-dot" />
              Переписка
            </div>
            <div className="art-message">
              Привет! Есть минутка? <small>12:40</small>
            </div>
            <div className="art-message reply">
              Да, что хотел?{' '}
              <small>
                12:41 <CheckCheck size={15} />
              </small>
            </div>
          </div>
        </div>
        <span className="intro-footer">MAX · GREEN-API</span>
      </section>
      <section className="login-panel">
        <div className="login-card">
          <div className="section-icon">
            <MessageCircle size={27} />
          </div>
          <h2>Вход в чат</h2>
          <p className="muted">Введите данные своего инстанса.</p>
          <form onSubmit={submit}>
            <label>
              ID инстанса
              <input
                name="idInstance"
                placeholder="Например, 3100000001"
                inputMode="numeric"
                required
                autoComplete="off"
                disabled={busy}
              />
            </label>
            <label>
              Токен API
              <div className="password-field">
                <input
                  name="apiTokenInstance"
                  type={showToken ? 'text' : 'password'}
                  placeholder="Ваш apiTokenInstance"
                  required
                  autoComplete="off"
                  disabled={busy}
                />
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => setShowToken(!showToken)}
                  aria-label={showToken ? 'Скрыть токен' : 'Показать токен'}
                >
                  {showToken ? <EyeOff size={19} /> : <Eye size={19} />}
                </button>
              </div>
            </label>
            <label>
              API URL
              <input
                name="apiUrl"
                type="url"
                defaultValue={config.apiUrl}
                required
                disabled={busy}
              />
              <span className="field-hint">Скопируйте адрес сервера из настроек инстанса.</span>
            </label>
            {error && (
              <div className="error" role="alert">
                <CircleAlert size={17} />
                {error}
              </div>
            )}
            <button className="primary login-submit" disabled={busy}>
              {busy ? 'Подключение…' : 'Войти в чат'}
              {!busy && <ArrowRight size={19} />}
            </button>
          </form>
          <p className="credentials-help">
            Данные для входа доступны в{' '}
            <a href="https://console.green-api.com/" target="_blank" rel="noreferrer">
              личном кабинете GREEN-API ↗
            </a>
          </p>
          <div className="privacy">
            <ShieldCheck size={20} />
            <span>После закрытия страницы нужно будет войти заново.</span>
          </div>
        </div>
      </section>
    </main>
  );
}
