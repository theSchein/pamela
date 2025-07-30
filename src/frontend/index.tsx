import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRoot } from "react-dom/client";
import "./index.css";
import React from "react";
import type { UUID } from "@elizaos/core";

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
  const agentId = config?.agentId;

  // Ensure light mode for OkayBet theme
  React.useEffect(() => {
    document.documentElement.classList.remove("dark");
    document.body.classList.add("gradient-bg");
  }, []);

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

  const sendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

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
      // Get API base from config or use default
      const config = window.ELIZA_CONFIG;
      const apiBase = config?.apiBase || "http://localhost:3000";

      // Send message to ElizaOS backend - try multiple possible endpoints
      let response;
      const messageData = {
        text: userMessage.text,
        userId: "frontend-user",
        userName: "User",
        content: { text: userMessage.text }
      };

      // Try different possible ElizaOS API endpoints
      const endpoints = [
        `/api/chat`,
        `/api/message`,
        `/chat`,
        `/message`,
        `/${agentId}/message`,
        `/api/agents/${agentId}/message`
      ];

      let lastError = null;
      for (const endpoint of endpoints) {
        try {
          response = await fetch(`${apiBase}${endpoint}`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(messageData),
          });
          
          if (response.ok) {
            break; // Found working endpoint
          }
        } catch (error) {
          lastError = error;
          continue;
        }
      }

      if (!response || !response.ok) {
        throw new Error(`All API endpoints failed. Last status: ${response?.status || 'Network Error'}`);
      }

      const data = await response.json();

      // Create Pamela's response from API
      const pamelaResponse: Message = {
        id: (Date.now() + 1).toString(),
        text:
          data.text ||
          data.content?.text ||
          "I received your message, but had trouble generating a response.",
        sender: "pamela",
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, pamelaResponse]);
      setIsLoading(false);
    } catch (error) {
      console.error("Error sending message:", error);

      // Fallback response on error
      const errorResponse: Message = {
        id: (Date.now() + 1).toString(),
        text: `I'm having trouble connecting to the backend right now. 

**Debugging Info:**
• Backend URL: ${window.ELIZA_CONFIG?.apiBase || "http://localhost:3000"}
• Error: ${error instanceof Error ? error.message : "Unknown error"}

**Make sure:**
1. ElizaOS backend is running (\`bun run dev\`)
2. Backend is accessible at the URL above

I tried multiple API endpoints but none worked. This might mean ElizaOS uses a different API structure than expected.`,
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
              <div className="w-2 h-2 bg-okaybet-cyan-400 rounded-full animate-pulse"></div>
              <span className="text-sm text-okaybet-cyan-600 font-medium">
                Online
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
                  placeholder="Ask Pamela about markets, place trades, or get portfolio insights..."
                  className="w-full p-3 border border-border rounded-lg bg-background resize-none focus:outline-none focus:ring-2 focus:ring-okaybet-cyan-400 focus:border-transparent min-h-[44px] max-h-32"
                  rows={1}
                  disabled={isLoading}
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
                disabled={!inputValue.trim() || isLoading}
                className="px-6 py-3 bg-okaybet-cyan-500 hover:bg-okaybet-cyan-600 disabled:bg-muted disabled:text-muted-foreground text-white rounded-lg font-medium transition-colors"
              >
                Send
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
