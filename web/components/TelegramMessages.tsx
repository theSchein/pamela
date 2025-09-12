'use client';

import { useTelegramMessages } from '@/hooks/useTelegramMessages';
import { MessageCircle, Bot, User } from 'lucide-react';

export function TelegramMessages() {
  const { data, isLoading, error } = useTelegramMessages();

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <MessageCircle className="h-5 w-5" />
          Agent Messages
        </h2>
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-200 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <MessageCircle className="h-5 w-5" />
          Agent Messages
        </h2>
        <p className="text-sm text-gray-500">
          Unable to load messages
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
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
        <MessageCircle className="h-5 w-5" />
        Agent Messages
        {botUsername && (
          <span className="text-xs text-gray-500">
            @{botUsername}
          </span>
        )}
      </h2>
      <div className="h-96 overflow-y-auto pr-4">
        <div className="space-y-4">
          {conversationPairs.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">
              No messages yet
            </p>
          ) : (
            conversationPairs.map((pair, index) => (
              <div key={index} className="space-y-2">
                {pair.query && (
                  <div className="flex gap-3">
                    <User className="h-5 w-5 text-gray-500 mt-0.5" />
                    <div className="flex-1">
                      <div className="bg-gray-100 rounded-lg p-3">
                        <p className="text-sm">{pair.query.text}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(pair.query.timestamp).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                {pair.response && (
                  <div className="flex gap-3">
                    <Bot className="h-5 w-5 text-blue-600 mt-0.5" />
                    <div className="flex-1">
                      <div className="bg-blue-50 rounded-lg p-3">
                        <p className="text-sm whitespace-pre-wrap">
                          {pair.response.text}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
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