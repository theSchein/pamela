// Telegram service for efficient real-time message polling
// Uses long polling with offset tracking for guaranteed message delivery

export interface TelegramUpdate {
  update_id: number;
  message?: any;
  edited_message?: any;
  channel_post?: any;
}

export class TelegramPollingService {
  private botToken: string | undefined;
  private lastUpdateId: number = 0;
  private messageBuffer: any[] = [];
  private isPolling: boolean = false;
  private pollTimeout: number = 25; // seconds for long polling
  private listeners: Set<(messages: any[]) => void> = new Set();
  private abortController: AbortController | null = null;
  
  constructor() {
    this.botToken = process.env.NEXT_PUBLIC_TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
  }
  
  // Subscribe to new messages
  subscribe(callback: (messages: any[]) => void) {
    this.listeners.add(callback);
    
    // Send current buffer immediately
    if (this.messageBuffer.length > 0) {
      callback([...this.messageBuffer]);
    }
    
    // Start polling if not already running
    if (!this.isPolling) {
      this.startPolling();
    }
    
    // Return unsubscribe function
    return () => {
      this.listeners.delete(callback);
      if (this.listeners.size === 0) {
        this.stopPolling();
      }
    };
  }
  
  // Start the polling loop
  async startPolling() {
    if (this.isPolling || !this.botToken) return;
    
    this.isPolling = true;
    
    while (this.isPolling) {
      try {
        await this.poll();
      } catch (error) {
        console.error('Telegram polling error:', error);
        // Wait before retrying
        await this.delay(5000);
      }
    }
  }
  
  // Stop polling
  stopPolling() {
    this.isPolling = false;
    this.abortController?.abort();
  }
  
  // Single poll cycle
  private async poll() {
    if (!this.botToken) return;
    
    const params = new URLSearchParams({
      offset: String(this.lastUpdateId + 1),
      limit: '100',
      timeout: String(this.pollTimeout),
      allowed_updates: JSON.stringify(['message', 'edited_message', 'channel_post'])
    });
    
    this.abortController = new AbortController();
    
    try {
      const response = await fetch(
        `https://api.telegram.org/bot${this.botToken}/getUpdates?${params}`,
        {
          signal: this.abortController.signal,
          // Add timeout to prevent hanging
          ...{ next: { revalidate: 0 } } // Disable Next.js caching
        }
      );
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.ok && data.result && data.result.length > 0) {
        this.processUpdates(data.result);
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        // Polling was cancelled, this is expected
        return;
      }
      throw error;
    }
  }
  
  // Process new updates
  private processUpdates(updates: TelegramUpdate[]) {
    if (!updates || updates.length === 0) return;
    
    // Update the last update ID
    const maxUpdateId = Math.max(...updates.map(u => u.update_id));
    this.lastUpdateId = maxUpdateId;
    
    // Process messages
    const newMessages = updates
      .filter(update => update.message || update.edited_message || update.channel_post)
      .map(update => {
        const msg = update.message || update.edited_message || update.channel_post;
        return {
          id: msg.message_id,
          updateId: update.update_id,
          text: msg.text || msg.caption || '',
          from: msg.from,
          chat: msg.chat,
          date: msg.date,
          timestamp: new Date(msg.date * 1000).toISOString(),
          type: update.edited_message ? 'edited' : (update.channel_post ? 'channel' : 'message'),
          entities: msg.entities || [],
          reply_to_message: msg.reply_to_message,
          isNew: true // Mark as new for UI highlighting
        };
      });
    
    if (newMessages.length > 0) {
      // Add to buffer
      this.messageBuffer.push(...newMessages);
      
      // Keep buffer size reasonable (last 200 messages)
      if (this.messageBuffer.length > 200) {
        this.messageBuffer = this.messageBuffer.slice(-200);
      }
      
      // Notify all listeners
      this.notifyListeners(newMessages);
    }
  }
  
  // Notify all listeners of new messages
  private notifyListeners(newMessages: any[]) {
    this.listeners.forEach(callback => {
      try {
        callback(newMessages);
      } catch (error) {
        console.error('Error in Telegram listener:', error);
      }
    });
  }
  
  // Get all buffered messages
  getMessages(): any[] {
    return [...this.messageBuffer];
  }
  
  // Clear message buffer
  clearBuffer() {
    this.messageBuffer = [];
  }
  
  // Utility delay function
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  // Get polling status
  getStatus() {
    return {
      isPolling: this.isPolling,
      lastUpdateId: this.lastUpdateId,
      bufferSize: this.messageBuffer.length,
      listenerCount: this.listeners.size
    };
  }
}

// Singleton instance
let serviceInstance: TelegramPollingService | null = null;

export function getTelegramService(): TelegramPollingService {
  if (!serviceInstance) {
    serviceInstance = new TelegramPollingService();
  }
  return serviceInstance;
}