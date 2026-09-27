import type { Session } from '@/entities/session';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import Login from '@/pages/login';
import Chat from '@/pages/chat';
export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const queryClient = useQueryClient();
  return session ? (
    <Chat
      session={session}
      onLogout={() => {
        queryClient.clear();
        setSession(null);
      }}
    />
  ) : (
    <Login onLogin={setSession} />
  );
}
