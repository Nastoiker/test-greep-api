export interface Message {
  id: string;
  text: string;
  direction: 'in' | 'out';
  time: number;
  status?: string | undefined;
}

export interface Chat {
  id: string;
  name: string;
  phone?: string | undefined;
  messages: Message[];
}
