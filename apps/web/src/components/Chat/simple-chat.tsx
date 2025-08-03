import React from 'react';
import io, { Socket } from 'socket.io-client';
import type { ChatMessage } from '@pamela/shared';

interface UIMessage extends ChatMessage {
  isThinking?: boolean;
}

// UUID v4 generator
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

const SimpleChat = () => {
  const [messages, setMessages] = React.useState<UIMessage[]>([
    {
      id: "1",
      role: "assistant",
      content: "Yo! I'm Pamela. Just closed a sweet position on the Fed rate decision - made $340 in two days 💅 Currently hunting for the next mispriced market. You trading anything interesting or just here to watch me work?",
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [socket, setSocket] = React.useState<Socket | null>(null);
  const [isConnected, setIsConnected] = React.useState(false);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  
  // Use persistent IDs that match ElizaOS format
  const channelId = '7226c0c4-f213-489e-a032-50d0079a5833'; // Persistent channel
  const [userId] = React.useState(() => generateUUID());
  const serverId = '00000000-0000-0000-0000-000000000000'; // Default server
  const agentId = import.meta.env.VITE_AGENT_ID || "df35947c-da83-0a0a-aa27-c4cc3ec722cd"; // Pamela's ID

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  React.useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Initialize Socket.IO connection
  React.useEffect(() => {
    console.log("Connecting to ElizaOS Socket.IO...");
    
    const newSocket = io(import.meta.env.VITE_API_URL || 'http://localhost:3000', {
      transports: ['websocket', 'polling'],
      upgrade: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    newSocket.on('connect', () => {
      console.log('Connected to ElizaOS Socket.IO');
      setIsConnected(true);
      
      // Send ROOM_JOINING (type 1) to join Pamela's room
      const joinPayload = {
        channelId: channelId,
        agentId: agentId,
      };
      console.log('Sending ROOM_JOINING:', joinPayload);
      newSocket.emit('1', joinPayload);
    });

    newSocket.on('disconnect', () => {
      console.log('Disconnected from ElizaOS');
      setIsConnected(false);
    });

    newSocket.on('error', (error: any) => {
      console.error('Socket error:', error);
    });

    // Listen for messageBroadcast events (the actual message format)
    newSocket.on('messageBroadcast', (data: any) => {
      console.log('Received messageBroadcast:', data);
      
      if (data.senderId === agentId && data.source === 'agent_response') {
        const assistantMessage: UIMessage = {
          id: data.id || Date.now().toString(),
          role: "assistant",
          content: data.text,
          timestamp: new Date(data.createdAt || Date.now()),
        };
        
        setMessages((prev) => [...prev, assistantMessage]);
        setIsLoading(false);
      }
    });
    
    // Listen for message acknowledgment
    newSocket.on('messageAck', (data: any) => {
      console.log('Message acknowledged:', data);
    });
    
    // Listen for completion
    newSocket.on('messageComplete', (data: any) => {
      console.log('Message complete:', data);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [channelId, userId, agentId]);

  const sendMessage = async () => {
    if (!inputValue.trim() || isLoading || !socket || !isConnected) return;

    const userMessage: UIMessage = {
      id: Date.now().toString(),
      role: "user",
      content: inputValue,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setIsLoading(true);

    try {
      // Send message using the EXACT format that works
      const messagePayload = {
        message: inputValue,  // This is the key field ElizaOS expects
        text: inputValue,     // Also include for compatibility
        channelId: channelId,
        roomId: channelId,
        serverId: serverId,
        server_id: serverId,  // Include both formats
        senderId: userId,
        author_id: userId,    // Include both formats
        source: 'client_chat',
        clientMessageId: generateUUID(),
        senderName: 'user'
      };
      
      console.log("Sending SEND_MESSAGE:", messagePayload);
      
      // Use the SEND_MESSAGE type (2)
      socket.emit('2', messagePayload);
      
      // Set a timeout in case we don't get a response
      setTimeout(() => {
        if (isLoading) {
          setIsLoading(false);
          const timeoutMessage: UIMessage = {
            id: Date.now().toString(),
            role: "assistant",
            content: "I'm having trouble connecting to my AI system. Please check the ElizaOS logs for more information.",
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, timeoutMessage]);
        }
      }, 10000); // 10 second timeout
      
    } catch (error) {
      console.error("Error sending message:", error);
      
      const errorMessage: UIMessage = {
        id: Date.now().toString(),
        role: "assistant",
        content: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
        timestamp: new Date(),
      };
      
      setMessages((prev) => [...prev, errorMessage]);
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
        <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
          {isConnected ? 'Connected to Pamela' : 'Connecting...'}
        </div>
        <div className="flex gap-3">
          <input
            type="text"
            className="flex-1 border border-gray-300 rounded-full px-4 py-2 focus:outline-none focus:border-blue-500"
            placeholder="Type a message..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={isLoading || !isConnected}
          />
          <button
            className={`px-6 py-2 rounded-full font-medium transition-colors ${
              !inputValue.trim() || isLoading || !isConnected
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-500 text-white hover:bg-blue-600 cursor-pointer'
            }`}
            onClick={sendMessage}
            disabled={!inputValue.trim() || isLoading || !isConnected}
          >
            {isLoading ? 'Sending...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SimpleChat;