// Real-time Telegram hook with improved polling and message tracking
import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { TelegramData, TelegramMessage } from './useTelegramMessages';

interface UseRealtimeTelegramOptions {
  enableLongPolling?: boolean;
  shortPollInterval?: number;
  maxRetries?: number;
  onNewMessage?: (message: TelegramMessage) => void;
}

export function useTelegramRealtime(options?: UseRealtimeTelegramOptions) {
  const {
    enableLongPolling = true,
    shortPollInterval = 5000, // Increased to reduce load
    maxRetries = 5, // More retries for better resilience
    onNewMessage
  } = options || {};
  
  const queryClient = useQueryClient();
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newMessageCount, setNewMessageCount] = useState(0);
  
  const longPollActiveRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const retryCountRef = useRef(0);
  const seenMessageIdsRef = useRef<Set<string>>(new Set());
  
  // Long polling implementation with improved error handling
  const startLongPolling = useCallback(async () => {
    if (longPollActiveRef.current || !enableLongPolling) return;
    
    longPollActiveRef.current = true;
    setIsConnected(true);
    setError(null);
    
    while (longPollActiveRef.current && retryCountRef.current < maxRetries) {
      try {
        abortControllerRef.current = new AbortController();
        
        const response = await fetch('/api/telegram?longPoll=true', {
          signal: abortControllerRef.current.signal,
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache',
          }
        });
        
        if (!response.ok && response.status !== 500) {
          // 500 errors might contain partial data, so we'll try to parse them
          throw new Error(`HTTP ${response.status}`);
        }
        
        const data: TelegramData = await response.json();
        
        // Check if this was a timeout (expected for long polling)
        if (data.meta?.timeout) {
          // This is normal for long polling, just continue
          retryCountRef.current = 0;
          continue;
        }
        
        // Check for API errors in meta
        if (data.meta?.error) {
          console.warn('Telegram API returned error:', data.meta.error);
          // Still process any cached messages that were returned
        }
        
        // Check for new messages
        if (data.messages && data.messages.length > 0) {
          const newMessages = data.messages.filter(msg => {
            const messageKey = `${msg.chat.id}-${msg.id}`;
            if (!seenMessageIdsRef.current.has(messageKey)) {
              seenMessageIdsRef.current.add(messageKey);
              return true;
            }
            return false;
          });
          
          if (newMessages.length > 0) {
            setNewMessageCount(prev => prev + newMessages.length);
            
            // Update React Query cache
            queryClient.setQueryData(['telegram-messages'], (oldData: TelegramData | undefined) => {
              if (!oldData) return data;
              
              // Merge messages, avoiding duplicates
              const existingIds = new Set(oldData.messages.map(m => `${m.chat.id}-${m.id}`));
              const mergedMessages = [
                ...newMessages.filter(m => !existingIds.has(`${m.chat.id}-${m.id}`)),
                ...oldData.messages
              ].slice(0, 100); // Keep last 100 messages
              
              return {
                ...data,
                messages: mergedMessages
              };
            });
            
            // Call callback for each new message
            newMessages.forEach(msg => onNewMessage?.(msg));
          }
        }
        
        // Reset retry count on successful poll
        retryCountRef.current = 0;
        
      } catch (error: any) {
        if (error.name === 'AbortError') {
          // Normal abort, not an error
          break;
        }
        
        console.error('Long polling error:', error);
        retryCountRef.current++;
        
        if (retryCountRef.current >= maxRetries) {
          setError(`Failed after ${maxRetries} retries`);
          setIsConnected(false);
          break;
        }
        
        // Wait before retrying (shorter backoff for better responsiveness)
        const waitTime = Math.min(1000 * Math.pow(1.5, retryCountRef.current), 10000);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
    
    longPollActiveRef.current = false;
    setIsConnected(false);
  }, [enableLongPolling, maxRetries, onNewMessage, queryClient]);
  
  // Stop long polling
  const stopLongPolling = useCallback(() => {
    longPollActiveRef.current = false;
    abortControllerRef.current?.abort();
    setIsConnected(false);
  }, []);
  
  // Reset new message count
  const resetNewMessageCount = useCallback(() => {
    setNewMessageCount(0);
  }, []);
  
  // Clear seen messages cache
  const clearSeenMessages = useCallback(() => {
    seenMessageIdsRef.current.clear();
  }, []);
  
  // Effect to manage long polling lifecycle
  useEffect(() => {
    if (enableLongPolling) {
      startLongPolling();
    }
    
    return () => {
      stopLongPolling();
    };
  }, [enableLongPolling, startLongPolling, stopLongPolling]);
  
  // Regular query for initial data and fallback
  const query = useQuery<TelegramData>({
    queryKey: ['telegram-messages'],
    queryFn: async () => {
      const response = await fetch('/api/telegram', {
        cache: 'no-store'
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch Telegram messages');
      }
      
      const data = await response.json();
      
      // Track initial messages as seen
      if (data.messages) {
        data.messages.forEach((msg: TelegramMessage) => {
          seenMessageIdsRef.current.add(`${msg.chat.id}-${msg.id}`);
        });
      }
      
      return data;
    },
    refetchInterval: enableLongPolling ? false : shortPollInterval,
    retry: 2,
    staleTime: enableLongPolling ? 60000 : 5000,
  });
  
  return {
    ...query,
    isConnected,
    connectionError: error,
    newMessageCount,
    resetNewMessageCount,
    clearSeenMessages,
    reconnect: startLongPolling,
    disconnect: stopLongPolling,
  };
}