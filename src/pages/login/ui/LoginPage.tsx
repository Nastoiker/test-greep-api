import { useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Credentials } from '@/shared/api/green-api';
import { ArrowRight, Eye, EyeOff } from 'lucide-react';
import { Alert, Button, IconButton, InputAdornment, Stack, TextField } from '@mui/material';
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
      <header className="login-header">
        <Logo />
        <span className="integration-badge">Клиент GREEN-API</span>
      </header>
      <section className="login-panel">
        <div className="login-card">
          <h1>Вход в чат</h1>
          <p className="muted">Подключите свой аккаунт MAX через GREEN-API.</p>
          <Stack component="form" spacing={3} onSubmit={submit}>
            <TextField
              label="ID инстанса"
              name="idInstance"
              placeholder="idInstance"
              slotProps={{ htmlInput: { inputMode: 'numeric', 'aria-label': 'ID инстанса' } }}
              required
              autoComplete="off"
              disabled={busy}
            />
            <TextField
              label="Токен API"
              name="apiTokenInstance"
              type={showToken ? 'text' : 'password'}
              placeholder="Ваш apiTokenInstance"
              required
              autoComplete="off"
              disabled={busy}
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        type="button"
                        onClick={() => setShowToken(!showToken)}
                        edge="end"
                        aria-label={showToken ? 'Скрыть токен' : 'Показать токен'}
                      >
                        {showToken ? <EyeOff size={19} /> : <Eye size={19} />}
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
            />
            <TextField
              label="API URL"
              name="apiUrl"
              type="url"
              defaultValue={config.apiUrl}
              helperText="Адрес сервера из настроек вашего инстанса."
              required
              disabled={busy}
            />
            {error && <Alert severity="error">{error}</Alert>}
            <Button
              type="submit"
              variant="outlined"
              fullWidth
              disabled={busy}
              endIcon={<ArrowRight size={19} />}
            >
              {busy ? 'Подключение…' : 'Войти в чат'}
            </Button>
          </Stack>
          <p className="session-note">После обновления страницы потребуется войти заново.</p>
        </div>
      </section>
    </main>
  );
}
