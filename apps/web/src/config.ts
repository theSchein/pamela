// @ts-ignore
export const API_URL = import.meta.env?.VITE_API_URL || 'http://localhost:3001';

export const api = {
  // Chat endpoints
  chat: `${API_URL}/api/chat`,
  
  // Market endpoints
  markets: `${API_URL}/api/markets`,
  marketDetails: (id: string) => `${API_URL}/api/markets/${id}`,
  marketPrices: (id: string) => `${API_URL}/api/markets/${id}/prices`,
  
  // Portfolio endpoints
  portfolio: `${API_URL}/api/portfolio`,
  positions: `${API_URL}/api/portfolio/positions`,
  balance: `${API_URL}/api/portfolio/balance`,
  
  // Trading endpoints
  placeOrder: `${API_URL}/api/orders`,
  cancelOrder: (id: string) => `${API_URL}/api/orders/${id}/cancel`,
  orderStatus: (id: string) => `${API_URL}/api/orders/${id}`,
  
  // WebSocket endpoint
  ws: API_URL.replace(/^http/, 'ws')
};

// WebSocket events
export const wsEvents = {
  // Incoming events
  MARKET_UPDATE: 'market:update',
  PRICE_UPDATE: 'price:update',
  ORDER_UPDATE: 'order:update',
  POSITION_UPDATE: 'position:update',
  PORTFOLIO_UPDATE: 'portfolio:update',
  
  // Outgoing events
  SUBSCRIBE_MARKET: 'market:subscribe',
  UNSUBSCRIBE_MARKET: 'market:unsubscribe',
  SUBSCRIBE_PORTFOLIO: 'portfolio:subscribe',
  UNSUBSCRIBE_PORTFOLIO: 'portfolio:unsubscribe',
};