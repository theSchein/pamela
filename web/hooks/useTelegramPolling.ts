// Improved Telegram polling hook with proper message tracking
import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

export interface TelegramMessage {
  id: number;
  updateId: number;
  text: string;
  from: {
    id: number;
    is_bot: boolean;
    first_name: string;
    username?: string;
  };
  chat: {
    id: number;
    type: string;
    title?: string;
    username?: string;
  };
  date: number;
  timestamp: string;
  type: 'message' | 'edited' | 'channel' | 'channel_edit';
  entities?: any[];
  reply_to_message?: any;
  isBot: boolean;
}

export interface TelegramData {
  bot: {
    id: number;
    username: string;
    first_name: string;
  } | null;
  messages: TelegramMessage[];
  meta: {
    offset: number;
    isPolling: boolean;
    lastPollTime: number;
    errorCount: number;
    bufferSize: number;
    listenerCount: number;
    totalMessages: number;
    newMessages?: number;
    status: string;
    error?: string;
    timeout?: boolean;
  };
}

interface UseTelegramPollingOptions {
  enablePolling?: boolean;
  pollInterval?: number;
  onNewMessage?: (message: TelegramMessage) => void;
  onError?: (error: Error) => void;
}

// Global flag to ensure only one instance is polling
let globalPollingActive = false;

export function useTelegramPolling(options: UseTelegramPollingOptions = {}) {
  const {
    enablePolling = true,
    pollInterval = 2000, // Fallback short poll interval
    onNewMessage,
    onError
  } = options;
  
  const queryClient = useQueryClient();
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [newMessageCount, setNewMessageCount] = useState(0);
  const [lastMessageTime, setLastMessageTime] = useState<number>(0);
  
  const longPollActiveRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const seenMessageIdsRef = useRef<Set<string>>(new Set());
  const retryCountRef = useRef(0);
  const maxRetries = 5;
  const instanceIdRef = useRef(Math.random());
  
  // Load seen messages from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('telegram_seen_messages');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        seenMessageIdsRef.current = new Set(parsed);
      } catch {}
    }
  }, []);
  
  // Save seen messages to localStorage
  const saveSeenMessages = useCallback(() => {
    const messages = Array.from(seenMessageIdsRef.current);
    // Keep only last 500 message IDs
    const toSave = messages.slice(-500);
    localStorage.setItem('telegram_seen_messages', JSON.stringify(toSave));
  }, []);
  
  // Process new messages
  const processNewMessages = useCallback((messages: TelegramMessage[]) => {
    const newMessages = messages.filter(msg => {
      const messageKey = `${msg.chat.id}_${msg.id}`;
      if (!seenMessageIdsRef.current.has(messageKey)) {
        seenMessageIdsRef.current.add(messageKey);
        return true;
      }
      return false;
    });
    
    if (newMessages.length > 0) {
      setNewMessageCount(prev => prev + newMessages.length);
      setLastMessageTime(Date.now());
      
      // Update cache with new messages
      queryClient.setQueryData(['telegram-polling'], (oldData: TelegramData | undefined) => {
        if (!oldData) return oldData;
        
        // Merge messages, keeping unique ones
        const existingIds = new Set(oldData.messages.map(m => `${m.chat.id}_${m.id}`));
        const mergedMessages = [
          ...newMessages.filter(m => !existingIds.has(`${m.chat.id}_${m.id}`)),
          ...oldData.messages
        ]
          .sort((a, b) => b.date - a.date) // Newest first
          .slice(0, 200); // Keep last 200 messages
        
        return {
          ...oldData,
          messages: mergedMessages,
          meta: {
            ...oldData.meta,
            totalMessages: mergedMessages.length,
            newMessages: newMessages.length
          }
        };
      });
      
      // Call callbacks for each new message
      newMessages.forEach(msg => {
        onNewMessage?.(msg);
        console.log(`New ${msg.isBot ? 'bot' : 'user'} message:`, msg.text.substring(0, 50));
      });
      
      // Save seen messages
      saveSeenMessages();
    }
    
    return newMessages;
  }, [queryClient, onNewMessage, saveSeenMessages]);
  
  // Long polling implementation with better lifecycle management
  const startLongPolling = useCallback(async () => {
    // Check global flag to ensure only one instance polls
    if (globalPollingActive || longPollActiveRef.current || !enablePolling) {
      console.log(`Skipping poll start - global: ${globalPollingActive}, local: ${longPollActiveRef.current}`);
      return;
    }
    
    globalPollingActive = true;
    longPollActiveRef.current = true;
    setIsConnected(true);
    setConnectionError(null);
    retryCountRef.current = 0;
    
    console.log(`Starting Telegram long polling (instance ${instanceIdRef.current.toFixed(4)})...`);
    
    while (longPollActiveRef.current) {
      // Check if we should continue
      if (!enablePolling || retryCountRef.current >= maxRetries) {
        break;
      }
      
      try {
        abortControllerRef.current = new AbortController();
        
        const response = await fetch('/api/telegram?longPoll=true', {
          signal: abortControllerRef.current.signal,
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache',
          }
        });
        
        if (!response.ok) {
          // Don't throw for expected status codes
          if (response.status === 500 || response.status === 503) {
            console.warn(`Telegram API returned ${response.status}, retrying...`);
            retryCountRef.current++;
            await new Promise(resolve => setTimeout(resolve, 2000));
            continue;
          }
          throw new Error(`HTTP ${response.status}`);
        }
        
        const data: TelegramData = await response.json();
        
        // Handle timeout (normal for long polling)
        if (data.meta?.timeout) {
          retryCountRef.current = 0; // Reset retry count on successful poll
          // Small delay before next poll
          await new Promise(resolve => setTimeout(resolve, 100));
          continue;
        }
        
        // Process any new messages
        if (data.messages && data.messages.length > 0) {
          processNewMessages(data.messages);
        }
        
        // Update meta information
        if (data.meta) {
          queryClient.setQueryData(['telegram-polling'], (oldData: TelegramData | undefined) => {
            if (!oldData) return data;
            return {
              ...oldData,
              meta: data.meta
            };
          });
        }
        
        // Reset retry count on success
        retryCountRef.current = 0;
        
        // Small delay before next poll
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error: any) {
        if (error.name === 'AbortError') {
          // Normal abort, not an error
          console.log('Long polling aborted');
          break;
        }
        
        console.error('Long polling error:', error.message);
        retryCountRef.current++;
        
        if (retryCountRef.current >= maxRetries) {
          setConnectionError(`Connection failed after ${maxRetries} attempts`);
          setIsConnected(false);
          onError?.(error);
          break;
        }
        
        // Wait before retrying with exponential backoff
        const waitTime = Math.min(1000 * Math.pow(2, retryCountRef.current), 10000);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
    
    longPollActiveRef.current = false;
    globalPollingActive = false; // Release global flag
    setIsConnected(false);
    console.log(`Telegram long polling stopped (instance ${instanceIdRef.current.toFixed(4)})`);
  }, [enablePolling, processNewMessages, queryClient, onError]);
  
  // Stop long polling
  const stopLongPolling = useCallback(() => {
    if (longPollActiveRef.current) {
      longPollActiveRef.current = false;
      globalPollingActive = false; // Release global flag
      abortControllerRef.current?.abort();
      setIsConnected(false);
      console.log(`Manually stopping polling (instance ${instanceIdRef.current.toFixed(4)})`);
    }
  }, []);
  
  // Reset new message count
  const resetNewMessageCount = useCallback(() => {
    setNewMessageCount(0);
  }, []);
  
  // Clear seen messages
  const clearSeenMessages = useCallback(() => {
    seenMessageIdsRef.current.clear();
    localStorage.removeItem('telegram_seen_messages');
  }, []);
  
  // Reset everything
  const reset = useCallback(async () => {
    stopLongPolling();
    clearSeenMessages();
    setNewMessageCount(0);
    setLastMessageTime(0);
    
    // Call reset endpoint
    await fetch('/api/telegram?reset=true');
    
    // Refetch data
    queryClient.invalidateQueries({ queryKey: ['telegram-polling'] });
  }, [stopLongPolling, clearSeenMessages, queryClient]);
  
  // Initial data fetch and fallback polling
  const query = useQuery<TelegramData>({
    queryKey: ['telegram-polling'],
    queryFn: async () => {
      const response = await fetch('/api/telegram', {
        cache: 'no-store'
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch Telegram messages');
      }
      
      const data: TelegramData = await response.json();
      
      // Mark initial messages as seen
      if (data.messages) {
        data.messages.forEach(msg => {
          const messageKey = `${msg.chat.id}_${msg.id}`;
          seenMessageIdsRef.current.add(messageKey);
        });
        saveSeenMessages();
      }
      
      return data;
    },
    refetchInterval: enablePolling && !isConnected ? pollInterval : false,
    retry: 2,
    staleTime: 60000,
  });
  
  // Start long polling when enabled - only once after initial data load
  useEffect(() => {
    // Only start if we have initial data and polling is not already active
    if (enablePolling && query.data && !longPollActiveRef.current && !isConnected) {
      // Small delay to prevent race conditions
      const timer = setTimeout(() => {
        if (!longPollActiveRef.current) {
          startLongPolling();
        }
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [enablePolling, query.data]); // Remove function dependencies to prevent re-runs
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (longPollActiveRef.current) {
        stopLongPolling();
      }
    };
  }, []);
  
  return {
    data: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    
    // Connection status
    isConnected,
    connectionError,
    
    // Message tracking
    newMessageCount,
    lastMessageTime,
    resetNewMessageCount,
    
    // Control functions
    reconnect: startLongPolling,
    disconnect: stopLongPolling,
    reset,
    clearSeenMessages,
    
    // Metadata
    pollingState: query.data?.meta,
  };
}