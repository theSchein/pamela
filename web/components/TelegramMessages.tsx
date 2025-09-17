'use client';

import { useTelegramPolling } from '@/hooks/useTelegramPolling';
import { MessageCircle, Bot, User, WifiOff, Wifi, RefreshCw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

export function TelegramMessages() {
  // DISABLED: Telegram polling conflicts with the bot's own polling
  // Both cannot use getUpdates API simultaneously
  const { 
    data, 
    isLoading, 
    error,
    isConnected,
    connectionError,
    newMessageCount,
    resetNewMessageCount,
    reconnect,
    disconnect,
    reset,
    refetch
  } = useTelegramPolling({
    enablePolling: false,  // DISABLED to prevent 409 Conflict errors with bot
    onNewMessage: (msg) => {
      console.log('New message received:', msg.text.substring(0, 50));
    }
  });
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const [lastMessageCount, setLastMessageCount] = useState(0);
  
  // Track new messages and auto-scroll
  useEffect(() => {
    if (data?.messages && data.messages.length > lastMessageCount) {
      setLastMessageCount(data.messages.length);
      // Auto-scroll to bottom on new message
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    }
  }, [data?.messages, lastMessageCount]);
  
  // Reset new message count when viewing
  useEffect(() => {
    if (newMessageCount > 0) {
      const timer = setTimeout(() => {
        resetNewMessageCount();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [newMessageCount, resetNewMessageCount]);

  if (isLoading) {
    return (
      <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-lg shadow-xl border-4 border-red-500 p-6">
        <h2 className="text-3xl font-bebas text-red-600 mb-4 flex items-center gap-2 drop-shadow-md">
          <MessageCircle className="h-6 w-6 text-red-600" />
          AGENT COMMUNICATIONS
        </h2>
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-red-200 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-lg shadow-xl border-4 border-red-500 p-6">
        <h2 className="text-3xl font-bebas text-red-600 mb-4 flex items-center gap-2 drop-shadow-md">
          <MessageCircle className="h-6 w-6 text-red-600" />
          AGENT COMMUNICATIONS
        </h2>
        <p className="text-sm font-russo text-red-700">
          SIGNAL LOST - UNABLE TO ESTABLISH COMMS
        </p>
      </div>
    );
  }

  const botUsername = data?.bot?.username;
  const messages = data?.messages || [];

  // Separate bot messages from user messages
  const conversationPairs = messages.reduce((acc: any[], msg) => {
    // Check if message is from the bot
    const isBot = msg.from.username === botUsername;
    
    if (isBot) {
      // Bot response - add to last pair or create new one
      const lastPair = acc[acc.length - 1];
      if (lastPair && !lastPair.response) {
        lastPair.response = msg;
      } else {
        acc.push({ response: msg });
      }
    } else {
      // User message - create new pair
      acc.push({ query: msg });
    }
    
    return acc;
  }, []);

  return (
    <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-lg shadow-xl border-4 border-red-500 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-3xl font-bebas text-red-600 flex items-center gap-2 drop-shadow-md">
          <MessageCircle className="h-6 w-6 text-red-600" />
          AGENT COMMUNICATIONS
          {botUsername && (
            <span className="text-sm font-russo text-red-700">
              @{botUsername}
            </span>
          )}
        </h2>
        <div className="flex items-center gap-2">
          {data?.messages && (
            <span className="text-xs font-russo text-red-700">
              {data.messages.length} MSGS
            </span>
          )}
          {newMessageCount > 0 && (
            <span className="text-xs font-russo text-green-600 animate-pulse">
              +{newMessageCount} NEW
            </span>
          )}
          {isConnected ? (
            <div className="flex items-center gap-1">
              <Wifi className="h-4 w-4 text-green-600 animate-pulse" />
              <span className="text-xs font-russo text-green-600">LIVE</span>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <WifiOff className="h-4 w-4 text-yellow-600" />
              <span className="text-xs font-russo text-yellow-600">OFFLINE</span>
            </div>
          )}
          <button 
            onClick={() => refetch()}
            className="flex items-center gap-1 text-red-600 hover:text-red-700 transition-colors"
            title="Refresh messages"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button 
            onClick={isConnected ? disconnect : reconnect}
            className="text-xs font-russo text-red-600 hover:text-red-700 transition-colors"
          >
            {isConnected ? 'PAUSE' : 'RESUME'}
          </button>
          <button 
            onClick={reset}
            className="text-xs font-russo text-red-600 hover:text-red-700 transition-colors"
            title="Reset and clear cache"
          >
            RESET
          </button>
        </div>
      </div>
      {connectionError && (
        <div className="bg-yellow-100 border border-yellow-400 rounded p-2 mb-2">
          <p className="text-xs font-russo text-yellow-700">
            CONNECTION ISSUE: {connectionError}
          </p>
        </div>
      )}
      <div className="bg-yellow-100 border-2 border-yellow-500 rounded p-3 mb-4">
        <p className="text-sm font-russo text-yellow-800">
          ⚠️ TELEGRAM MONITORING DISABLED: Cannot poll while bot is running (409 Conflict). 
          Only one process can use getUpdates at a time. Stop the bot to enable monitoring.
        </p>
      </div>
      <div ref={scrollRef} className="h-96 overflow-y-auto pr-4">
        <div className="space-y-4">
          {conversationPairs.length === 0 ? (
            <p className="text-sm font-russo text-red-700 text-center py-8">
              MONITORING DISABLED - BOT IS ACTIVE
            </p>
          ) : (
            conversationPairs.map((pair, index) => (
              <div key={index} className="space-y-2">
                {pair.query && (
                  <div className="flex gap-3">
                    <User className="h-5 w-5 text-red-600 mt-0.5" />
                    <div className="flex-1">
                      <div className="bg-yellow-100 border-2 border-yellow-400 rounded-lg p-3">
                        <p className="text-sm font-russo text-red-800">{pair.query.text}</p>
                        <p className="text-xs font-russo text-red-600 mt-1">
                          {new Date(pair.query.timestamp).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                {pair.response && (
                  <div className="flex gap-3">
                    <Bot className="h-5 w-5 text-red-600 mt-0.5" />
                    <div className="flex-1">
                      <div className="bg-red-50 border-2 border-red-400 rounded-lg p-3">
                        <p className="text-sm font-russo text-red-900 whitespace-pre-wrap">
                          {pair.response.text}
                        </p>
                        <p className="text-xs font-russo text-red-600 mt-1">
                          {new Date(pair.response.timestamp).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}