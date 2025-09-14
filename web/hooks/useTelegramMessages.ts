import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useCallback } from 'react';

export interface TelegramMessage {
  id: number;
  updateId: number;
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
  type: 'message' | 'edited' | 'channel';
  entities?: any[];
  reply_to_message?: any;
}

export interface TelegramBot {
  id: number;
  username: string;
  first_name: string;
}

export interface TelegramData {
  bot: TelegramBot;
  messages: TelegramMessage[];
  meta: {
    lastUpdateId: number;
    cacheSize: number;
    newMessages: number;
    longPolling: boolean;
  };
}

export function useTelegramMessages(options?: { 
  enableLongPolling?: boolean;
  pollingInterval?: number;
}) {
  const queryClient = useQueryClient();
  const longPollRef = useRef<boolean>(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  
  const enableLongPolling = options?.enableLongPolling ?? true;
  const pollingInterval = options?.pollingInterval ?? 2000; // 2 seconds for short polling
  
  // Long polling function
  const longPoll = useCallback(async () => {
    if (!enableLongPolling || longPollRef.current) return;
    
    longPollRef.current = true;
    
    while (longPollRef.current) {
      try {
        abortControllerRef.current = new AbortController();
        
        const response = await fetch('/api/telegram?longPoll=true', {
          signal: abortControllerRef.current.signal
        });
        
        if (response.ok) {
          const data = await response.json();
          
          // Update cache if we got new messages
          if (data.meta?.newMessages > 0) {
            queryClient.setQueryData(['telegram-messages'], data);
          }
        }
      } catch (error: any) {
        if (error.name !== 'AbortError') {
          console.error('Long polling error:', error);
          // Wait a bit before retrying on error
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      }
    }
  }, [queryClient, enableLongPolling]);
  
  // Clean up on unmount
  useEffect(() => {
    if (enableLongPolling) {
      longPoll();
    }
    
    return () => {
      longPollRef.current = false;
      abortControllerRef.current?.abort();
    };
  }, [longPoll, enableLongPolling]);
  
  // Regular query for initial data and fallback
  return useQuery<TelegramData>({
    queryKey: ['telegram-messages'],
    queryFn: async () => {
      const response = await fetch('/api/telegram');
      if (!response.ok) {
        throw new Error('Failed to fetch Telegram messages');
      }
      return response.json();
    },
    refetchInterval: enableLongPolling ? false : pollingInterval,
    retry: 1,
    staleTime: enableLongPolling ? 60000 : 5000, // Longer stale time with long polling
  });
}