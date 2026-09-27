import type { FormEvent, KeyboardEvent } from 'react';
interface Props {
  draft: string;
  busy: boolean;
  error: string;
  onChange: (text: string) => void;
  onSend: () => void;
}
import { Send } from 'lucide-react';

export default function Composer({ draft, busy, error, onChange, onSend }: Props) {
  function submit(event: FormEvent<HTMLFormElement> | KeyboardEvent<HTMLTextAreaElement>) {
    event.preventDefault();
    if (draft.trim() && !busy) onSend();
  }
  return (
    <div className="composer-wrap">
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      <form className="composer" onSubmit={submit}>
        <textarea
          aria-label="Сообщение"
          placeholder="Напишите сообщение…"
          value={draft}
          onChange={(event) => onChange(event.target.value)}
          disabled={busy}
          maxLength={4000}
          rows={1}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing)
              submit(event);
          }}
        />
        <button
          className="send-button"
          aria-label="Отправить сообщение"
          disabled={!draft.trim() || busy}
        >
          <Send size={21} />
        </button>
      </form>
      <div className="composer-hint">
        <span>Enter — отправить · Shift + Enter — новая строка</span>
        <span>{draft.length} / 4000</span>
      </div>
    </div>
  );
}
