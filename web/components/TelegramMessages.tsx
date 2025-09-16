'use client';

import { useTelegramSimple } from '@/hooks/useTelegramSimple';
import { MessageCircle, Bot, User, WifiOff, Wifi, RefreshCw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

export function TelegramMessages() {
  // Use the simpler polling mechanism for better reliability
  const { 
    data, 
    isLoading, 
    error,
    isPolling,
    togglePolling,
    refresh,
    lastError,
    hasData
  } = useTelegramSimple(8000); // Poll every 8 seconds
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const [lastMessageCount, setLastMessageCount] = useState(0);
  
  // Track new messages
  useEffect(() => {
    if (data?.messages && data.messages.length > lastMessageCount) {
      setLastMessageCount(data.messages.length);
      // Auto-scroll to bottom on new message
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    }
  }, [data?.messages, lastMessageCount]);

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
          {hasData && (
            <span className="text-xs font-russo text-red-700">
              {data?.messages?.length || 0} MSGS
            </span>
          )}
          {isPolling ? (
            <div className="flex items-center gap-1">
              <Wifi className="h-4 w-4 text-green-600 animate-pulse" />
              <span className="text-xs font-russo text-green-600">POLLING</span>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <WifiOff className="h-4 w-4 text-yellow-600" />
              <span className="text-xs font-russo text-yellow-600">PAUSED</span>
            </div>
          )}
          <button 
            onClick={refresh}
            className="flex items-center gap-1 text-red-600 hover:text-red-700 transition-colors"
            title="Refresh messages"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button 
            onClick={togglePolling}
            className="text-xs font-russo text-red-600 hover:text-red-700 transition-colors"
          >
            {isPolling ? 'PAUSE' : 'RESUME'}
          </button>
        </div>
      </div>
      {lastError && (
        <div className="bg-yellow-100 border border-yellow-400 rounded p-2 mb-2">
          <p className="text-xs font-russo text-yellow-700">
            NETWORK ISSUE: {lastError} - Data may be cached
          </p>
        </div>
      )}
      <div ref={scrollRef} className="h-96 overflow-y-auto pr-4">
        <div className="space-y-4">
          {conversationPairs.length === 0 ? (
            <p className="text-sm font-russo text-red-700 text-center py-8">
              RADIO SILENT - MONITORING CHANNELS
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