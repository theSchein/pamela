import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRoot } from "react-dom/client";
import "./index.css";
import React from "react";
import type { UUID } from "@elizaos/core";
import { io, Socket } from "socket.io-client";

// Message interface
interface Message {
  id: string;
  text: string;
  sender: "user" | "pamela";
  timestamp: Date;
}

const queryClient = new QueryClient();

// Define the interface for the ELIZA_CONFIG
interface ElizaConfig {
  agentId: string;
  apiBase: string;
}

// Declare global window extension for TypeScript
declare global {
  interface Window {
    ELIZA_CONFIG?: ElizaConfig;
  }
}

/**
 * Main Example route component
 */
function ExampleRoute() {
  const config = window.ELIZA_CONFIG;
  const [realAgentId, setRealAgentId] = React.useState<string>("");
  
  // Fetch the real agent ID from the server
  React.useEffect(() => {
    const fetchAgentId = async () => {
      const baseUrl = config?.apiBase || "http://localhost:3000";
      const endpoints = [
        "/api/agents",
        "/agents", 
        "/api/runtime/agents",
        "/runtime/agents"
      ];

      for (const endpoint of endpoints) {
        try {
          console.log(`Trying agent endpoint: ${baseUrl}${endpoint}`);
          const response = await fetch(`${baseUrl}${endpoint}`);
          if (response.ok) {
            const data = await response.json();
            console.log("Agent API response:", data);
            
            let agentId = null;
            if (Array.isArray(data) && data.length > 0) {
              agentId = data[0].id || data[0].agentId || data[0].uuid;
            } else if (data.id || data.agentId || data.uuid) {
              agentId = data.id || data.agentId || data.uuid;
            } else if (data.agents && Array.isArray(data.agents) && data.agents.length > 0) {
              agentId = data.agents[0].id || data.agents[0].agentId || data.agents[0].uuid;
            }
            
            if (agentId) {
              console.log("Found real agent ID:", agentId);
              setRealAgentId(agentId);
              return;
            }
          }
        } catch (error) {
          console.log(`Failed to fetch from ${endpoint}:`, error);
        }
      }
      
      // If all endpoints fail, use fallback
      console.log("All agent endpoints failed, using fallback agent ID");
      setRealAgentId("df35947c-da83-0a0a-aa27-c4cc3ec722cd");
    };
    
    fetchAgentId();
  }, [config?.apiBase]);
  
  const agentId = realAgentId || config?.agentId || "df35947c-da83-0a0a-aa27-c4cc3ec722cd";

  // Ensure light mode for OkayBet theme
  React.useEffect(() => {
    document.documentElement.classList.remove("dark");
    document.body.classList.add("gradient-bg");
  }, []);

  // Wait for real agent ID before rendering
  if (!realAgentId) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="card-gradient rounded-lg p-8 text-center max-w-md w-full shadow-lg">
          <div className="text-okaybet-cyan-500 font-semibold text-lg mb-2">
            Connecting to Pamela...
          </div>
          <div className="text-muted-foreground">
            Finding agent ID from ElizaOS server
          </div>
        </div>
      </div>
    );
  }

  if (!agentId) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="card-gradient rounded-lg p-8 text-center max-w-md w-full shadow-lg">
          <div className="text-okaybet-red-500 font-semibold text-lg mb-2">
            Configuration Error
          </div>
          <div className="text-muted-foreground">
            Agent ID not found. The server should inject the agent
            configuration.
          </div>
          <div className="mt-4 text-xs text-muted-foreground">
            OkayBet AI Trading Agent
          </div>
        </div>
      </div>
    );
  }

  return <ExampleProvider agentId={agentId as UUID} />;
}

/**
 * OkayBet Pamela AI Trading Agent Provider with Chat Interface
 */
function ExampleProvider({ agentId }: { agentId: UUID }) {
  const [messages, setMessages] = React.useState<Message[]>([
    {
      id: "1",
      text: 'Hello! I\'m Pamela, your AI trading agent for prediction markets. I can help you analyze markets, execute trades, and manage your Polymarket portfolio.\n\nTry asking me:\n• "Show me active prediction markets"\n• "What\'s the current price for Bitcoin reaching $100k?"\n• "Buy 10 shares of YES in [market name]"\n• "Check my portfolio positions"\n\nWhat would you like to explore today?',
      sender: "pamela",
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
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
    const serverUrl = config?.apiBase || "http://localhost:3000";
    
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
      console.log('Received message broadcast:', data);
      
      // Create Pamela's response from WebSocket message
      const pamelaResponse: Message = {
        id: (Date.now() + Math.random()).toString(),
        text: data.message || data.text || data.content?.text || "I received your message.",
        sender: "pamela",
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, pamelaResponse]);
      setIsLoading(false);
    });

    newSocket.on('message', (data) => {
      console.log('Received message:', data);
      
      // Handle any message responses
      if (data && data.text) {
        const pamelaResponse: Message = {
          id: (Date.now() + Math.random()).toString(),
          text: data.text,
          sender: "pamela",
          timestamp: new Date(),
        };

        setMessages((prev) => [...prev, pamelaResponse]);
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
        text: `Failed to connect to ElizaOS WebSocket server.

**Connection Error:**
• Server: ${serverUrl}
• Error: ${error.message}

**Make sure:**
1. ElizaOS backend is running (\`bun run dev\`)
2. WebSocket server is accessible at ${serverUrl}
3. Agent ID ${agentId.slice(0, 8)}... is valid`,
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

    setMessages((prev) => [...prev, userMessage]);
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
      
      // Try both formats
      socket.emit("message", messageData);
      
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
        text: `Failed to send message via WebSocket.

**Error:** ${error instanceof Error ? error.message : "Unknown error"}

**Status:**
• Connected: ${isConnected ? "Yes" : "No"}
• Socket: ${socket ? "Available" : "Not available"}
• Channel ID: ${channelId || "Not set"}
• Sender ID: ${senderId || "Not set"}
• Server ID: ${serverId || "Not set"}
• Agent ID: ${agentId}

**Using ElizaOS Protocol:**
• ROOM_JOINING for channel joining
• SEND_MESSAGE for message sending
• Listening for: messageBroadcast, messageAck, messageComplete`,
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
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen flex flex-col">
        {/* Header */}
        <div className="card-gradient border-b border-border/20 p-4">
          <div className="flex items-center justify-between max-w-4xl mx-auto">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-okaybet-cyan-400 to-okaybet-cyan-600 flex items-center justify-center">
                <span className="text-white font-bold text-lg">P</span>
              </div>
              <div>
                <h1 className="text-xl font-semibold text-gradient">
                  Pamela AI Trading Agent
                </h1>
                <p className="text-sm text-muted-foreground">
                  Powered by OkayBet • Agent: {agentId.slice(0, 8)}...
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${isConnected 
                ? 'bg-okaybet-cyan-400 animate-pulse' 
                : 'bg-okaybet-red-400'
              }`}></div>
              <span className={`text-sm font-medium ${isConnected 
                ? 'text-okaybet-cyan-600' 
                : 'text-okaybet-red-600'
              }`}>
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
          </div>
        </div>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="max-w-4xl mx-auto space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.sender === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg p-4 ${
                    message.sender === "user"
                      ? "bg-okaybet-cyan-500 text-white"
                      : "card-gradient border border-border/20"
                  }`}
                >
                  <div className="text-sm whitespace-pre-wrap">
                    {message.text}
                  </div>
                  <div
                    className={`text-xs mt-2 ${
                      message.sender === "user"
                        ? "text-okaybet-cyan-100"
                        : "text-muted-foreground"
                    }`}
                  >
                    {message.timestamp.toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="card-gradient border border-border/20 rounded-lg p-4">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-okaybet-cyan-400 rounded-full animate-pulse"></div>
                    <div
                      className="w-2 h-2 bg-okaybet-cyan-400 rounded-full animate-pulse"
                      style={{ animationDelay: "0.2s" }}
                    ></div>
                    <div
                      className="w-2 h-2 bg-okaybet-cyan-400 rounded-full animate-pulse"
                      style={{ animationDelay: "0.4s" }}
                    ></div>
                    <span className="text-sm text-muted-foreground ml-2">
                      Pamela is thinking...
                    </span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Chat Input */}
        <div className="card-gradient border-t border-border/20 p-4">
          <div className="max-w-4xl mx-auto">
            <div className="flex space-x-4">
              <div className="flex-1">
                <textarea
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder={isConnected 
                    ? "Ask Pamela about markets, place trades, or get portfolio insights..." 
                    : "Connecting to Pamela..."
                  }
                  className="w-full p-3 border border-border rounded-lg bg-background resize-none focus:outline-none focus:ring-2 focus:ring-okaybet-cyan-400 focus:border-transparent min-h-[44px] max-h-32"
                  rows={1}
                  disabled={isLoading || !isConnected}
                  style={{
                    height: "auto",
                    minHeight: "44px",
                  }}
                  onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement;
                    target.style.height = "auto";
                    target.style.height = target.scrollHeight + "px";
                  }}
                />
              </div>
              <button
                onClick={sendMessage}
                disabled={!inputValue.trim() || isLoading || !isConnected}
                className="px-6 py-3 bg-okaybet-cyan-500 hover:bg-okaybet-cyan-600 disabled:bg-muted disabled:text-muted-foreground text-white rounded-lg font-medium transition-colors"
              >
                {isLoading ? 'Sending...' : 'Send'}
              </button>
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              Press Enter to send • Shift+Enter for new line
            </div>
          </div>
        </div>
      </div>
    </QueryClientProvider>
  );
}

// Initialize the application - no router needed for iframe
const rootElement = document.getElementById("root");
if (rootElement) {
  createRoot(rootElement).render(<ExampleRoute />);
}

// Define types for integration with agent UI system
export interface AgentPanel {
  name: string;
  path: string;
  component: React.ComponentType<any>;
  icon?: string;
  public?: boolean;
  shortLabel?: string; // Optional short label for mobile
}

interface PanelProps {
  agentId: string;
}

/**
 * OkayBet Pamela AI Trading Panel Component
 */
const PanelComponent: React.FC<PanelProps> = ({ agentId }) => {
  return (
    <div className="p-6 space-y-6">
      <div className="card-gradient rounded-lg p-6">
        <h2 className="text-xl font-semibold text-gradient mb-2">
          Pamela AI Trading Agent
        </h2>
        <p className="text-muted-foreground mb-4">
          Connected Agent: <span className="font-mono text-sm">{agentId}</span>
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-lg bg-okaybet-cyan-50 border border-okaybet-cyan-100">
            <h3 className="font-medium text-okaybet-cyan-700 mb-2">
              Market Status
            </h3>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-okaybet-cyan-400 rounded-full animate-pulse"></div>
              <span className="text-sm text-okaybet-cyan-600">Active</span>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-okaybet-red-50 border border-okaybet-red-100">
            <h3 className="font-medium text-okaybet-red-700 mb-2">
              Trading Status
            </h3>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-okaybet-red-400 rounded-full"></div>
              <span className="text-sm text-okaybet-red-600">Ready</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Export the panel configuration for integration with the agent UI
export const panels: AgentPanel[] = [
  {
    name: "Pamela AI Trading",
    path: "pamela-trading",
    component: PanelComponent,
    icon: "TrendingUp",
    public: true,
    shortLabel: "Pamela",
  },
];

export * from "./utils";
