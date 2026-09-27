import type { FormEvent, KeyboardEvent } from 'react';
import { Alert, IconButton, InputBase } from '@mui/material';
interface Props {
  draft: string;
  busy: boolean;
  error: string;
  onChange: (text: string) => void;
  onSend: () => void;
}
import { Send } from 'lucide-react';

export default function Composer({ draft, busy, error, onChange, onSend }: Props) {
  function submit(
    event: FormEvent<HTMLFormElement> | KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) {
    event.preventDefault();
    if (draft.trim() && !busy) onSend();
  }
  return (
    <div className="composer-wrap">
      {error && (
        <Alert severity="error" sx={{ mb: 1.5 }}>
          {error}
        </Alert>
      )}
      <form className="composer" onSubmit={submit}>
        <InputBase
          multiline
          fullWidth
          minRows={1}
          maxRows={6}
          slotProps={{ input: { 'aria-label': 'Сообщение', maxLength: 4000 } }}
          placeholder="Напишите сообщение…"
          value={draft}
          onChange={(event) => onChange(event.target.value)}
          disabled={busy}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing)
              submit(event);
          }}
        />
        <IconButton
          type="submit"
          sx={{
            bgcolor: 'primary.main',
            color: 'primary.contrastText',
            borderRadius: 1,
            '&:hover': { bgcolor: 'primary.dark' },
          }}
          aria-label="Отправить сообщение"
          disabled={!draft.trim() || busy}
        >
          <Send size={21} />
        </IconButton>
      </form>
      <div className="composer-hint">
        <span>Enter — отправить · Shift + Enter — новая строка</span>
        <span>{draft.length} / 4000</span>
      </div>
    </div>
  );
}
