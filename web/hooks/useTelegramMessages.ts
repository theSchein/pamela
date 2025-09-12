import { useQuery } from '@tanstack/react-query';

export interface TelegramMessage {
  id: number;
  text: string;
  from: {
    id: number;
    username?: string;
    first_name: string;
  };
  chat: {
    id: number;
    type: string;
  };
  date: number;
  timestamp: string;
}

export interface TelegramBot {
  id: number;
  username: string;
  first_name: string;
}

export interface TelegramData {
  bot: TelegramBot;
  messages: TelegramMessage[];
}

export function useTelegramMessages() {
  return useQuery<TelegramData>({
    queryKey: ['telegram-messages'],
    queryFn: async () => {
      const response = await fetch('/api/telegram');
      if (!response.ok) {
        throw new Error('Failed to fetch Telegram messages');
      }
      return response.json();
    },
    refetchInterval: 5000, // Refresh every 5 seconds
    retry: 1,
  });
}