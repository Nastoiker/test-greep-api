import { Button, IconButton, InputBase } from '@mui/material';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Check,
  CheckCheck,
  CircleAlert,
  Clock3,
  LogOut,
  MessageCircle,
  Plus,
  Search,
} from 'lucide-react';
import { useChatSession } from '../model/useChatSession';
import { time, date } from '@/shared/lib/dates';
import Logo from '@/shared/ui/logo';
import NewChat from '@/features/create-chat';
import Composer from '@/features/send-message';
import type { Session } from '@/entities/session';
import type { Chat as ChatModel } from '@/entities/chat';
const statusLabels: Record<string, string> = {
  queued: 'В очереди',
  sent: 'Отправлено',
  delivered: 'Доставлено',
  read: 'Прочитано',
  failed: 'Не доставлено',
  noAccount: 'Аккаунт не найден',
  notInGroup: 'Нет доступа к группе',
  pending: 'Ожидание',
};
export default function Chat({ session, onLogout }: { session: Session; onLogout: () => void }) {
  const { chats, drafts, sending, errors, dispatch, send, getSignal, pollError, reconnect } =
    useChatSession(session.api);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [showNew, setShowNew] = useState(false);
  const bottom = useRef<HTMLDivElement | null>(null);
  const chat = chats.find((item) => item.id === activeId);
  const search = query.trim().toLowerCase();
  const visibleChats = chats
    .filter((item) => `${item.name} ${item.phone ?? ''}`.toLowerCase().includes(search))
    .map((item) => ({ chat: item, lastMessage: item.messages.at(-1) }))
    .sort((a, b) => (b.lastMessage?.time ?? 0) - (a.lastMessage?.time ?? 0));
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end' });
  }, [chat?.messages.length, activeId]);
  function createChat(newChat: ChatModel) {
    dispatch({ type: 'upsert', chat: newChat });
    setActiveId(newChat.id);
    setShowNew(false);
    setQuery('');
  }
  return (
    <main className={`chat-shell ${chat ? 'has-active-chat' : ''}`}>
      <aside className="sidebar">
        <header className="sidebar-header">
          <Logo small />
          <span className="integration-badge">GREEN-API</span>
        </header>
        <div className="sidebar-title">
          <h1>
            Сообщения <span>{chats.length}</span>
          </h1>
          <IconButton
            className="new-button"
            onClick={() => setShowNew(true)}
            aria-label="Новый чат"
          >
            <Plus size={21} />
          </IconButton>
        </div>
        <div className="search-field">
          <Search size={18} />
          <InputBase
            slotProps={{ input: { 'aria-label': 'Поиск чатов' } }}
            placeholder="Поиск"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <nav className="chat-list" aria-label="Чаты">
          {visibleChats.map(({ chat: item, lastMessage }) => (
            <Button
              className={`chat-item ${item.id === activeId ? 'selected' : ''}`}
              key={item.id}
              aria-current={item.id === activeId ? 'true' : undefined}
              onClick={() => setActiveId(item.id)}
            >
              <div className="avatar">
                {item.name.startsWith('+') ? (
                  <MessageCircle size={23} />
                ) : (
                  item.name.slice(0, 2).toUpperCase()
                )}
              </div>
              <div className="chat-item-copy">
                <div>
                  <strong>{item.name}</strong>
                  <time>{lastMessage ? time(lastMessage.time) : ''}</time>
                </div>
                <p>{lastMessage?.text || 'Нет сообщений'}</p>
              </div>
            </Button>
          ))}
          {!chats.length && (
            <div className="no-chats">
              <MessageCircle size={30} />
              <h3>Пока нет чатов</h3>
              <p>
                Добавьте собеседника
                <br />
                по номеру телефона.
              </p>
              <Button className="text-button" onClick={() => setShowNew(true)}>
                Создать чат <Plus size={16} />
              </Button>
            </div>
          )}
          {!!chats.length && !visibleChats.length && <p className="no-results">Чаты не найдены</p>}
        </nav>
        <footer className="account">
          <div className="account-avatar">Я</div>
          <div>
            <strong>Мой аккаунт</strong>
            <span>
              <i className={`online-dot ${pollError ? 'offline' : ''}`} />
              {pollError ? 'Нет соединения' : 'Подключён к MAX'}
            </span>
          </div>
          <IconButton
            className="icon-button"
            aria-label="Выйти"
            title="Выйти"
            onClick={() => {
              onLogout();
            }}
          >
            <LogOut size={19} />
          </IconButton>
        </footer>
      </aside>
      <section className="conversation" aria-label="Переписка">
        {session.warning && (
          <div className="notice" role="status">
            <CircleAlert size={18} />
            <span>{session.warning}</span>
          </div>
        )}
        {pollError && (
          <div className="notice error" role="alert">
            <span>{pollError} Получение сообщений прервано.</span>
            <Button
              className="text-button"
              onClick={() => {
                reconnect();
              }}
            >
              Подключиться снова
            </Button>
          </div>
        )}
        {chat ? (
          <>
            <header className="conversation-header">
              <IconButton
                className="icon-button mobile-back"
                aria-label="Назад к чатам"
                onClick={() => setActiveId(null)}
              >
                <ArrowLeft size={22} />
              </IconButton>
              <div className="avatar">
                {chat.name.startsWith('+') ? (
                  <MessageCircle size={23} />
                ) : (
                  chat.name.slice(0, 2).toUpperCase()
                )}
              </div>
              <div>
                <h2>{chat.name}</h2>
                <p>Личный чат · MAX</p>
              </div>
            </header>
            <div className="messages" role="log" aria-label="Сообщения чата" aria-live="polite">
              {!chat.messages.length && (
                <div className="first-message">
                  <div className="section-icon">
                    <MessageCircle size={27} />
                  </div>
                  <h3>Нет сообщений</h3>
                  <p>Напишите первое сообщение.</p>
                </div>
              )}
              {chat.messages.map((message, index) => (
                <div key={message.id}>
                  {(!index || date(chat.messages[index - 1]!.time) !== date(message.time)) && (
                    <div className="date-label">{date(message.time)}</div>
                  )}
                  <div className={`message-row ${message.direction}`}>
                    <div className="bubble">
                      <p>{message.text}</p>
                      <div className="message-meta">
                        <time>{time(message.time)}</time>
                        {message.direction === 'out' && (
                          <span
                            title={statusLabels[message.status ?? ''] || message.status}
                            aria-label={statusLabels[message.status ?? ''] || message.status}
                          >
                            {['failed', 'noAccount', 'notInGroup'].includes(
                              message.status ?? '',
                            ) ? (
                              <CircleAlert size={14} />
                            ) : ['queued', 'pending'].includes(message.status ?? '') ? (
                              <Clock3 size={14} />
                            ) : ['read', 'delivered'].includes(message.status ?? '') ? (
                              <CheckCheck size={15} />
                            ) : (
                              <Check size={15} />
                            )}
                          </span>
                        )}
                      </div>
                      {['failed', 'noAccount', 'notInGroup'].includes(message.status ?? '') && (
                        <small className="failed-label">Не доставлено</small>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={bottom} />
            </div>
            <Composer
              draft={drafts[chat.id] || ''}
              busy={!!sending[chat.id]}
              error={errors[chat.id] || ''}
              onChange={(text) => dispatch({ type: 'draft', chatId: chat.id, text })}
              onSend={() => send(chat.id, drafts[chat.id] || '')}
            />
          </>
        ) : (
          <div className="welcome">
            <div className="welcome-art">
              <MessageCircle size={55} strokeWidth={1.5} />
            </div>
            <h2>Выберите чат</h2>
            <p>Откройте переписку слева или добавьте собеседника.</p>
            <Button className="primary" onClick={() => setShowNew(true)}>
              <Plus size={19} />
              Создать чат
            </Button>
          </div>
        )}
      </section>
      {showNew && (
        <NewChat
          api={session.api}
          chats={chats}
          getSignal={getSignal}
          onClose={() => setShowNew(false)}
          onCreate={createChat}
        />
      )}
    </main>
  );
}
