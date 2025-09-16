// Simplified Telegram hook with better error resilience
import { useQuery } from '@tanstack/react-query';
import { useState, useEffect } from 'react';

export interface SimpleTelegramMessage {
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

interface SimpleTelegramData {
  bot: {
    id: number;
    username: string;
    first_name: string;
  } | null;
  messages: SimpleTelegramMessage[];
  error?: string;
}

export function useTelegramSimple(pollingInterval = 10000) {
  const [isPolling, setIsPolling] = useState(true);
  const [lastError, setLastError] = useState<string | null>(null);
  
  const query = useQuery<SimpleTelegramData>({
    queryKey: ['telegram-simple'],
    queryFn: async () => {
      try {
        // Try regular polling (no long polling to avoid timeouts)
        const response = await fetch('/api/telegram', {
          signal: AbortSignal.timeout(5000), // 5 second timeout
        });
        
        // Always try to parse response, even on error
        const data = await response.json().catch(() => ({
          bot: null,
          messages: [],
          meta: { status: 'error', error: 'Parse error' }
        }));
        
        // Check for errors but still use any data we have
        if (data.meta?.status === 'error' || data.meta?.error) {
          setLastError(data.meta?.error || 'Connection issue');
        } else {
          setLastError(null);
        }
        
        // Always return a valid structure
        return {
          bot: data.bot || null,
          messages: Array.isArray(data.messages) ? data.messages : [],
          error: data.meta?.error
        };
      } catch (error: any) {
        // Network error - return empty data
        console.log('Telegram network issue, using fallback');
        setLastError('Network unavailable');
        
        return {
          bot: null,
          messages: [],
          error: 'Network unavailable'
        };
      }
    },
    refetchInterval: isPolling ? pollingInterval : false,
    retry: (failureCount, error: any) => {
      // Only retry on network errors, not on API errors
      return failureCount < 2 && error?.message?.includes('fetch');
    },
    retryDelay: 2000,
    staleTime: 5000,
  });
  
  // Toggle polling
  const togglePolling = () => setIsPolling(!isPolling);
  
  // Provide a way to manually refresh
  const refresh = () => {
    setLastError(null);
    query.refetch();
  };
  
  return {
    ...query,
    isPolling,
    togglePolling,
    refresh,
    lastError,
    hasData: (query.data?.messages?.length ?? 0) > 0,
  };
}