'use client';

import { useTelegramMessages } from '@/hooks/useTelegramMessages';
import { MessageCircle, Bot, User } from 'lucide-react';

export function TelegramMessages() {
  const { data, isLoading, error } = useTelegramMessages();

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
      <h2 className="text-3xl font-bebas text-red-600 mb-4 flex items-center gap-2 drop-shadow-md">
        <MessageCircle className="h-6 w-6 text-red-600" />
        AGENT COMMUNICATIONS
        {botUsername && (
          <span className="text-sm font-russo text-red-700">
            @{botUsername}
          </span>
        )}
      </h2>
      <div className="h-96 overflow-y-auto pr-4">
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