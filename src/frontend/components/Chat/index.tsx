import React from 'react';
import { io, Socket } from "socket.io-client";
import type { UUID } from "@elizaos/core";

// Message interface
interface Message {
  id: string;
  text: string;
  sender: "user" | "pamela";
  timestamp: Date;
}

const Chat = () => {
  const [messages, setMessages] = React.useState<Message[]>([
    {
      id: "1",
      text: "Hello! I'm Pamela, your AI trading agent for prediction markets. I can help you analyze markets, execute trades, and manage your Polymarket portfolio.\n\nTry asking me:\n• \"Show me active prediction markets\"\n• \"What's the current price for Bitcoin reaching $100k?\"\n• \"Buy 10 shares of YES in [market name]\"\n• \"Check my portfolio positions\"\n\nWhat would you like to explore today?",
      sender: "pamela",
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const thinkingMessageIdRef = React.useRef<string | null>(null);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  React.useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Socket.IO connection state
  const [socket, setSocket] = React.useState<Socket | null>(null);
  const [isConnected, setIsConnected] = React.useState(false);
  const [channelId, setChannelId] = React.useState<string>("");
  const [senderId, setSenderId] = React.useState<string>("");
  const [serverId, setServerId] = React.useState<string>("");
  const [agentId, setAgentId] = React.useState<UUID>("df35947c-da83-0a0a-aa27-c4cc3ec722cd" as UUID);


  // Generate UUIDs for ElizaOS protocol
  const generateUUID = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  };

  // Initialize Socket.IO connection
  React.useEffect(() => {
    const config = window.ELIZA_CONFIG;
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const serverUrl = isLocal ? 'http://localhost:3000' : (config?.apiBase || 'https://pamela-production.up.railway.app');
    
    // Generate proper UUIDs as required by ElizaOS validation
    const newChannelId = generateUUID(); // Must be valid UUID
    const newSenderId = generateUUID(); // Must be valid UUID  
    const newServerId = "00000000-0000-0000-0000-000000000000"; // Use default server ID
    setChannelId(newChannelId);
    setSenderId(newSenderId);
    setServerId(newServerId);
    
    console.log("Connecting to ElizaOS WebSocket:", serverUrl);
    console.log("Channel ID:", newChannelId);
    console.log("Sender ID:", newSenderId);
    console.log("Server ID:", newServerId);
    console.log("Agent ID:", agentId);
    
    const newSocket = io(serverUrl, {
      transports: ['websocket', 'polling'],
      upgrade: true,
    });

    newSocket.on('connect', () => {
      console.log('Connected to ElizaOS WebSocket');
      setIsConnected(true);
      
      // Join user to room first
      console.log('User joining room with roomId:', newChannelId);
      newSocket.emit('join', {
        roomId: newChannelId,
        agentId: agentId
      });

      // Also use the type-based format to join user
      newSocket.emit("message", {
        type: 1,
        payload: {
          channelId: newChannelId,
          roomId: newChannelId,
          entityId: newSenderId
        }
      });

      // Join agent to the same room after a short delay
      setTimeout(() => {
        console.log('Adding agent to room:', agentId);
        newSocket.emit("message", {
          type: 1,
          payload: {
            channelId: newChannelId,
            roomId: newChannelId,
            entityId: agentId  // Add the agent as participant
          }
        });
      }, 200);
    });

    newSocket.on('disconnect', () => {
      console.log('Disconnected from ElizaOS WebSocket');
      setIsConnected(false);
    });

    // Listen for all ElizaOS events
    newSocket.on('join', (data) => {
      console.log('Join response:', data);
    });

    newSocket.on('messageBroadcast', (data) => {
      
      // Ignore messages sent by the current user
      // Ignore messages sent by the current user (the echo)
      if (data.payload?.senderId === senderId || data.senderId === senderId) {
        return;
      }

      // It's a real response from Pamela, so replace the placeholder
      const pamelaResponse: Message = {
        id: (Date.now() + Math.random()).toString(),
        text: data.message || data.text || data.content?.text || "I received a response.",
        sender: "pamela",
        timestamp: new Date(),
      };

      if (thinkingMessageIdRef.current) {
        setMessages((prev) => {
          const filtered = prev.filter((msg) => msg.id !== thinkingMessageIdRef.current);
          return [...filtered, pamelaResponse];
        });
        thinkingMessageIdRef.current = null;
      } else {
        setMessages((prev) => [...prev, pamelaResponse]);
      }

      setIsLoading(false);
    });

    newSocket.on('message', (data) => {
      
      // Ignore messages sent by the current user
      // Ignore messages sent by the current user (the echo)
      if (data.payload?.senderId === senderId || data.senderId === senderId) {
        return;
      }

      // It's a real response from Pamela, so replace the placeholder
      if (data && data.text) {
        const pamelaResponse: Message = {
          id: (Date.now() + Math.random()).toString(),
          text: data.text,
          sender: "pamela",
          timestamp: new Date(),
        };

        if (thinkingMessageIdRef.current) {
          setMessages((prev) => {
            const filtered = prev.filter((msg) => msg.id !== thinkingMessageIdRef.current);
            return [...filtered, pamelaResponse];
          });
          thinkingMessageIdRef.current = null;
        } else {
          setMessages((prev) => [...prev, pamelaResponse]);
        }

        setIsLoading(false);
      }
    });

    newSocket.on('messageAck', (data) => {
      console.log('Message acknowledged:', data);
    });

    newSocket.on('messageComplete', (data) => {
      console.log('Message processing complete:', data);
      setIsLoading(false);
    });

    newSocket.on('messageError', (data) => {
      console.error('Message error:', data);
      setIsLoading(false);
      
      const errorResponse: Message = {
        id: (Date.now() + Math.random()).toString(),
        text: `Error: ${data.error || 'Unknown message error'}`, 
        sender: "pamela",
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, errorResponse]);
    });

    newSocket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
      setIsConnected(false);
      
      // Show connection error to user
      const errorResponse: Message = {
        id: (Date.now() + Math.random()).toString(),
        text: `Failed to connect to ElizaOS WebSocket server.\n\n**Connection Error:**\n• Server: ${serverUrl}\n• Error: ${error.message}\n\n**Make sure:**\n1. ElizaOS backend is running (\`bun run dev\`)\n2. WebSocket server is accessible at ${serverUrl}\n3. Agent ID ${agentId.slice(0, 8)}... is valid`,
        sender: "pamela",
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, errorResponse]);
      setIsLoading(false);
    });

    setSocket(newSocket);

    // Cleanup on unmount
    return () => {
      newSocket.disconnect();
    };
  }, [agentId]);

  const sendMessage = async () => {
    if (!inputValue.trim() || isLoading || !socket || !isConnected || !channelId || !senderId || !serverId) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputValue,
      sender: "user",
      timestamp: new Date(),
    };

    const thinkingMessage: Message = {
      id: (Date.now() + 1).toString(), // Ensure unique ID
      text: "Pamela is thinking...",
      sender: "pamela",
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage, thinkingMessage]);
    thinkingMessageIdRef.current = thinkingMessage.id;
    setInputValue("");
    setIsLoading(true);

    try {
      // Try hybrid format - eliza.how style with additional fields that worked
      const messageData = {
        text: userMessage.text,
        roomId: channelId,
        userId: senderId,
        name: "User",
        // Add fields that previously worked
        senderId: senderId,
        message: userMessage.text,
        channelId: channelId,
        serverId: serverId,
        source: "client_chat"
      };

      console.log('Sending message via WebSocket:', messageData);
      
      // Use the exact working format from localhost:3000 logs
      socket.emit("message", {
        type: 2,
        payload: {
          senderId: senderId,
          senderName: "user",
          message: userMessage.text,
          channelId: channelId,
          roomId: channelId,
          serverId: serverId,
          messageId: generateUUID(),
          source: "client_chat",
          metadata: {
            channelType: "DM",
            isDm: true,
            targetUserId: agentId  // This is the key missing field!
          }
        }
      });

      // Set timeout in case we don't get a response
      setTimeout(() => {
        if (isLoading) {
          setIsLoading(false);
          const timeoutResponse: Message = {
            id: (Date.now() + Math.random()).toString(),
            text: "I'm taking longer than expected to respond. Please try again.",
            sender: "pamela",
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, timeoutResponse]);
        }
      }, 30000); // 30 second timeout

    } catch (error) {
      console.error("Error sending message via WebSocket:", error);

      // Fallback response on error
      const errorResponse: Message = {
        id: (Date.now() + Math.random()).toString(),
        text: `Failed to send message via WebSocket.\n\n**Error:** ${error instanceof Error ? error.message : "Unknown error"}\n\n**Status:**\n• Connected: ${isConnected ? "Yes" : "No"}\n• Socket: ${socket ? "Available" : "Not available"}\n• Channel ID: ${channelId || "Not set"}\n• Sender ID: ${senderId || "Not set"}\n• Server ID: ${serverId || "Not set"}\n• Agent ID: ${agentId}\n\n**Using ElizaOS Protocol:**\n• ROOM_JOINING for channel joining\n• SEND_MESSAGE for message sending\n• Listening for: messageBroadcast, messageAck, messageComplete`,
        sender: "pamela",
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, errorResponse]);
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
    <div style={{ width: '50%', backgroundColor: 'white', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }} ref={messagesEndRef}>
        {messages.map((message) => (
          <div
            key={message.id}
            style={{
              display: 'flex',
              justifyContent: message.sender === 'user' ? 'flex-end' : 'flex-start',
              marginBottom: '20px',
            }}
          >
            <div
              style={{
                backgroundColor: message.sender === 'user' ? '#007bff' : '#f0f0f0',
                color: message.sender === 'user' ? 'white' : 'black',
                borderRadius: '10px',
                padding: '10px',
                maxWidth: '80%',
              }}
            >
              {message.text}
            </div>
          </div>
        ))}
        
      </div>
      <div style={{ padding: '20px', borderTop: '1px solid #ccc' }}>
        <div style={{ display: 'flex' }}>
          <input
            type="text"
            style={{ flex: 1, border: '1px solid #ccc', borderRadius: '20px', padding: '10px' }}
            placeholder="Type a message..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={isLoading || !isConnected}
          />
          <button
            style={{ backgroundColor: '#007bff', color: 'white', borderRadius: '20px', padding: '10px 20px', marginLeft: '10px', border: 'none', cursor: 'pointer' }}
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

export default Chat;