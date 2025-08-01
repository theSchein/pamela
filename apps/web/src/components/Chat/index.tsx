import React from 'react';
import { apiClient } from '../../api/client';
import type { ChatMessage } from '@pamela/shared';

// Message interface for UI (extends ChatMessage with UI-specific fields)
interface UIMessage extends ChatMessage {
  isThinking?: boolean;
}

const Chat = () => {
  const [messages, setMessages] = React.useState<UIMessage[]>([
    {
      id: "1",
      role: "assistant",
      content: "Hello! I'm Pamela, your AI trading agent for prediction markets. I can help you analyze markets, execute trades, and manage your Polymarket portfolio.\n\nTry asking me:\n• \"Show me active prediction markets\"\n• \"What's the current price for Bitcoin reaching $100k?\"\n• \"Buy 10 shares of YES in [market name]\"\n• \"Check my portfolio positions\"\n\nWhat would you like to explore today?",
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [conversationId] = React.useState(() => 
    `conv-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  );
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  React.useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: UIMessage = {
      id: Date.now().toString(),
      role: "user",
      content: inputValue,
      timestamp: new Date(),
    };

    const thinkingMessage: UIMessage = {
      id: (Date.now() + 1).toString(),
      role: "assistant",
      content: "Pamela is thinking...",
      timestamp: new Date(),
      isThinking: true,
    };

    setMessages((prev) => [...prev, userMessage, thinkingMessage]);
    setInputValue("");
    setIsLoading(true);

    try {
      // Send message via API
      const response = await apiClient.sendMessage(inputValue, conversationId);
      
      // Replace thinking message with actual response
      setMessages((prev) => {
        const filtered = prev.filter((msg) => !msg.isThinking);
        return [...filtered, response];
      });
    } catch (error) {
      console.error("Error sending message:", error);
      
      // Replace thinking message with error
      const errorMessage: UIMessage = {
        id: (Date.now() + Math.random()).toString(),
        role: "assistant",
        content: `I encountered an error: ${error instanceof Error ? error.message : "Unknown error"}. Please make sure the backend is running and try again.`,
        timestamp: new Date(),
      };

      setMessages((prev) => {
        const filtered = prev.filter((msg) => !msg.isThinking);
        return [...filtered, errorMessage];
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="flex-1 overflow-y-auto p-5">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex mb-5 ${
              message.role === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            <div
              className={`rounded-lg px-4 py-2 max-w-[80%] ${
                message.role === 'user'
                  ? 'bg-blue-500 text-white'
                  : message.isThinking
                  ? 'bg-gray-100 text-gray-500 italic'
                  : 'bg-gray-100 text-black'
              }`}
            >
              <div className="whitespace-pre-wrap">{message.content}</div>
              <div className="text-xs mt-1 opacity-70">
                {new Date(message.timestamp).toLocaleTimeString()}
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      
      <div className="p-5 border-t border-gray-200">
        <div className="flex gap-3">
          <input
            type="text"
            className="flex-1 border border-gray-300 rounded-full px-4 py-2 focus:outline-none focus:border-blue-500"
            placeholder="Type a message..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={isLoading}
          />
          <button
            className={`px-6 py-2 rounded-full font-medium transition-colors ${
              !inputValue.trim() || isLoading
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-500 text-white hover:bg-blue-600 cursor-pointer'
            }`}
            onClick={sendMessage}
            disabled={!inputValue.trim() || isLoading}
          >
            {isLoading ? 'Sending...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Chat;