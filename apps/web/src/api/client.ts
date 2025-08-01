import { api, wsEvents } from '../config';
import type {
  ChatMessage,
  Market,
  Portfolio,
  Order,
  ApiResponse,
  WsMessage,
} from '@pamela/shared';

class ApiClient {
  private ws: WebSocket | null = null;
  private wsReconnectTimeout: NodeJS.Timeout | null = null;
  private wsListeners: Map<string, Set<(data: any) => void>> = new Map();

  // Chat methods
  async sendMessage(message: string, conversationId?: string): Promise<ChatMessage> {
    const response = await fetch(api.chat, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, conversationId }),
    });
    
    const result: ApiResponse<ChatMessage> = await response.json();
    if (!result.success || !result.data) {
      throw new Error(result.error || 'Failed to send message');
    }
    
    return result.data;
  }

  // Market methods
  async getMarkets(params?: { limit?: number; active?: boolean }): Promise<Market[]> {
    const queryParams = new URLSearchParams();
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.active !== undefined) queryParams.append('active', params.active.toString());
    
    const response = await fetch(`${api.markets}?${queryParams}`);
    const result: ApiResponse<Market[]> = await response.json();
    
    if (!result.success || !result.data) {
      throw new Error(result.error || 'Failed to fetch markets');
    }
    
    return result.data;
  }

  async getMarketDetails(marketId: string): Promise<Market> {
    const response = await fetch(api.marketDetails(marketId));
    const result: ApiResponse<Market> = await response.json();
    
    if (!result.success || !result.data) {
      throw new Error(result.error || 'Failed to fetch market details');
    }
    
    return result.data;
  }

  // Portfolio methods
  async getPortfolio(): Promise<Portfolio> {
    try {
      const response = await fetch(api.portfolio);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result: ApiResponse<Portfolio> = await response.json();
      
      if (!result.success || !result.data) {
        throw new Error(result.error || 'Failed to fetch portfolio');
      }
      
      return result.data;
    } catch (error) {
      console.error('Portfolio fetch error:', error);
      throw error;
    }
  }

  // Trading methods
  async placeOrder(order: {
    marketId: string;
    outcomeId: string;
    side: 'buy' | 'sell';
    type: 'limit' | 'market';
    amount: number;
    price?: number;
  }): Promise<Order> {
    const response = await fetch(api.placeOrder, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(order),
    });
    
    const result: ApiResponse<Order> = await response.json();
    if (!result.success || !result.data) {
      throw new Error(result.error || 'Failed to place order');
    }
    
    return result.data;
  }

  async cancelOrder(orderId: string): Promise<void> {
    const response = await fetch(api.cancelOrder(orderId), {
      method: 'POST',
    });
    
    const result: ApiResponse<void> = await response.json();
    if (!result.success) {
      throw new Error(result.error || 'Failed to cancel order');
    }
  }

  // WebSocket methods
  connectWebSocket(): void {
    if (this.ws?.readyState === WebSocket.OPEN) return;
    
    this.ws = new WebSocket(api.ws);
    
    this.ws.onopen = () => {
      console.log('WebSocket connected');
      if (this.wsReconnectTimeout) {
        clearTimeout(this.wsReconnectTimeout);
        this.wsReconnectTimeout = null;
      }
    };
    
    this.ws.onmessage = (event) => {
      try {
        const message: WsMessage = JSON.parse(event.data);
        const listeners = this.wsListeners.get(message.type);
        if (listeners) {
          listeners.forEach(listener => listener(message.payload));
        }
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };
    
    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
    
    this.ws.onclose = () => {
      console.log('WebSocket disconnected');
      // Reconnect after 5 seconds
      this.wsReconnectTimeout = setTimeout(() => this.connectWebSocket(), 5000);
    };
  }

  disconnectWebSocket(): void {
    if (this.wsReconnectTimeout) {
      clearTimeout(this.wsReconnectTimeout);
      this.wsReconnectTimeout = null;
    }
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  // Subscribe to WebSocket events
  on(event: string, callback: (data: any) => void): () => void {
    if (!this.wsListeners.has(event)) {
      this.wsListeners.set(event, new Set());
    }
    
    this.wsListeners.get(event)!.add(callback);
    
    // Return unsubscribe function
    return () => {
      const listeners = this.wsListeners.get(event);
      if (listeners) {
        listeners.delete(callback);
        if (listeners.size === 0) {
          this.wsListeners.delete(event);
        }
      }
    };
  }

  // Subscribe to specific market
  subscribeToMarket(marketId: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: wsEvents.SUBSCRIBE_MARKET,
        payload: { marketId },
        timestamp: new Date(),
      }));
    }
  }

  unsubscribeFromMarket(marketId: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: wsEvents.UNSUBSCRIBE_MARKET,
        payload: { marketId },
        timestamp: new Date(),
      }));
    }
  }

  // Subscribe to portfolio updates
  subscribeToPortfolio(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: wsEvents.SUBSCRIBE_PORTFOLIO,
        payload: {},
        timestamp: new Date(),
      }));
    }
  }

  unsubscribeFromPortfolio(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: wsEvents.UNSUBSCRIBE_PORTFOLIO,
        payload: {},
        timestamp: new Date(),
      }));
    }
  }
}

// Export singleton instance
export const apiClient = new ApiClient();