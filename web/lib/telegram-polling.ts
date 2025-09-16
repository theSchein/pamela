// Improved Telegram Polling Service with proper offset tracking
// Based on official Telegram Bot API best practices

interface TelegramUpdate {
  update_id: number;
  message?: any;
  edited_message?: any;
  channel_post?: any;
  channel_post_edit?: any;
}

interface TelegramMessage {
  id: number;
  updateId: number;
  text: string;
  from: any;
  chat: any;
  date: number;
  timestamp: string;
  type: 'message' | 'edited' | 'channel' | 'channel_edit';
  entities?: any[];
  reply_to_message?: any;
  isBot: boolean;
}

interface PollingState {
  offset: number;
  isPolling: boolean;
  lastPollTime: number;
  errorCount: number;
}

export class TelegramPollingService {
  private botToken: string;
  private state: PollingState;
  private messageBuffer: Map<string, TelegramMessage> = new Map();
  private listeners: Set<(messages: TelegramMessage[]) => void> = new Set();
  private abortController: AbortController | null = null;
  private pollTimeout: number = 25; // Long polling timeout in seconds
  private maxBufferSize: number = 500;
  
  constructor(botToken: string) {
    if (!botToken) {
      throw new Error('Bot token is required');
    }
    
    this.botToken = botToken;
    this.state = {
      offset: 0,
      isPolling: false,
      lastPollTime: 0,
      errorCount: 0
    };
    
    // Load persisted offset if available (from localStorage in browser context)
    if (typeof window !== 'undefined' && window.localStorage) {
      const savedOffset = localStorage.getItem('telegram_offset');
      if (savedOffset) {
        this.state.offset = parseInt(savedOffset, 10);
      }
    }
  }
  
  // Start polling for updates
  async startPolling(): Promise<void> {
    if (this.state.isPolling) return;
    
    this.state.isPolling = true;
    this.state.errorCount = 0;
    
    console.log(`Starting Telegram polling with offset ${this.state.offset}`);
    
    while (this.state.isPolling) {
      try {
        await this.pollOnce();
        this.state.errorCount = 0; // Reset error count on success
      } catch (error) {
        this.state.errorCount++;
        console.error(`Telegram polling error (attempt ${this.state.errorCount}):`, error);
        
        // Exponential backoff with max delay of 30 seconds
        const delay = Math.min(1000 * Math.pow(2, this.state.errorCount - 1), 30000);
        await this.delay(delay);
        
        // Stop polling after 10 consecutive errors
        if (this.state.errorCount >= 10) {
          console.error('Too many polling errors, stopping');
          this.stopPolling();
          break;
        }
      }
    }
  }
  
  // Stop polling
  stopPolling(): void {
    this.state.isPolling = false;
    this.abortController?.abort();
    console.log('Telegram polling stopped');
  }
  
  // Single poll cycle
  private async pollOnce(): Promise<void> {
    this.abortController = new AbortController();
    
    const params = new URLSearchParams({
      offset: this.state.offset.toString(),
      limit: '100',
      timeout: this.pollTimeout.toString(),
      allowed_updates: JSON.stringify(['message', 'edited_message', 'channel_post', 'channel_post_edit'])
    });
    
    const response = await fetch(
      `https://api.telegram.org/bot${this.botToken}/getUpdates?${params}`,
      {
        signal: this.abortController.signal,
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        }
      }
    );
    
    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (!data.ok) {
      throw new Error(`Telegram API error: ${data.description || 'Unknown error'}`);
    }
    
    this.state.lastPollTime = Date.now();
    
    // Process updates if any
    if (data.result && data.result.length > 0) {
      this.processUpdates(data.result);
    }
  }
  
  // Process incoming updates
  private processUpdates(updates: TelegramUpdate[]): void {
    if (!updates || updates.length === 0) return;
    
    console.log(`Processing ${updates.length} Telegram updates`);
    
    const newMessages: TelegramMessage[] = [];
    
    for (const update of updates) {
      // Extract message from different update types
      const msg = update.message || 
                  update.edited_message || 
                  update.channel_post || 
                  update.channel_post_edit;
      
      if (!msg) continue;
      
      // Create unique key for deduplication
      const messageKey = `${msg.chat.id}_${msg.message_id}`;
      
      // Check if we already have this message
      if (this.messageBuffer.has(messageKey)) {
        // Update existing message if it's an edit
        if (update.edited_message || update.channel_post_edit) {
          const existingMsg = this.messageBuffer.get(messageKey)!;
          existingMsg.text = msg.text || msg.caption || '';
          existingMsg.type = update.edited_message ? 'edited' : 'channel_edit';
          newMessages.push(existingMsg);
        }
        continue;
      }
      
      // Create processed message
      const processedMessage: TelegramMessage = {
        id: msg.message_id,
        updateId: update.update_id,
        text: msg.text || msg.caption || '',
        from: msg.from,
        chat: msg.chat,
        date: msg.date,
        timestamp: new Date(msg.date * 1000).toISOString(),
        type: update.edited_message ? 'edited' : 
              update.channel_post ? 'channel' : 
              update.channel_post_edit ? 'channel_edit' : 'message',
        entities: msg.entities || [],
        reply_to_message: msg.reply_to_message,
        isBot: msg.from?.is_bot || false
      };
      
      // Add to buffer
      this.messageBuffer.set(messageKey, processedMessage);
      newMessages.push(processedMessage);
      
      // Update offset to confirm this update
      if (update.update_id >= this.state.offset) {
        this.state.offset = update.update_id + 1;
      }
    }
    
    // Persist the new offset
    this.persistOffset();
    
    // Trim buffer if needed (keep newest messages)
    if (this.messageBuffer.size > this.maxBufferSize) {
      const sortedMessages = Array.from(this.messageBuffer.entries())
        .sort((a, b) => b[1].date - a[1].date)
        .slice(0, this.maxBufferSize);
      this.messageBuffer = new Map(sortedMessages);
    }
    
    // Notify listeners of new messages
    if (newMessages.length > 0) {
      console.log(`Notifying listeners of ${newMessages.length} new messages`);
      this.notifyListeners(newMessages);
    }
  }
  
  // Persist offset to storage
  private persistOffset(): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem('telegram_offset', this.state.offset.toString());
    }
    // In server context, you might want to save to a file or database
  }
  
  // Subscribe to new messages
  subscribe(callback: (messages: TelegramMessage[]) => void): () => void {
    this.listeners.add(callback);
    
    // Send current buffer to new subscriber
    if (this.messageBuffer.size > 0) {
      callback(Array.from(this.messageBuffer.values()));
    }
    
    // Return unsubscribe function
    return () => {
      this.listeners.delete(callback);
    };
  }
  
  // Notify all listeners
  private notifyListeners(messages: TelegramMessage[]): void {
    this.listeners.forEach(callback => {
      try {
        callback(messages);
      } catch (error) {
        console.error('Error in message listener:', error);
      }
    });
  }
  
  // Get all buffered messages
  getMessages(): TelegramMessage[] {
    return Array.from(this.messageBuffer.values())
      .sort((a, b) => a.date - b.date); // Chronological order
  }
  
  // Get recent messages
  getRecentMessages(limit: number = 50): TelegramMessage[] {
    return Array.from(this.messageBuffer.values())
      .sort((a, b) => b.date - a.date) // Newest first
      .slice(0, limit);
  }
  
  // Clear message buffer (keeps offset)
  clearBuffer(): void {
    this.messageBuffer.clear();
  }
  
  // Reset everything including offset
  reset(): void {
    this.state.offset = 0;
    this.messageBuffer.clear();
    this.persistOffset();
    console.log('Telegram polling service reset');
  }
  
  // Get current state
  getState(): PollingState & { bufferSize: number; listenerCount: number } {
    return {
      ...this.state,
      bufferSize: this.messageBuffer.size,
      listenerCount: this.listeners.size
    };
  }
  
  // Utility delay function
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  // Manual fetch with specific offset (for recovery)
  async fetchUpdates(fromOffset?: number): Promise<TelegramMessage[]> {
    const offset = fromOffset ?? this.state.offset;
    
    const params = new URLSearchParams({
      offset: offset.toString(),
      limit: '100',
      timeout: '0' // No long polling for manual fetch
    });
    
    const response = await fetch(
      `https://api.telegram.org/bot${this.botToken}/getUpdates?${params}`
    );
    
    if (!response.ok) {
      throw new Error(`Failed to fetch updates: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (!data.ok) {
      throw new Error(`Telegram API error: ${data.description}`);
    }
    
    // Process but don't update offset for manual fetch
    const messages: TelegramMessage[] = [];
    
    if (data.result && data.result.length > 0) {
      for (const update of data.result) {
        const msg = update.message || update.edited_message || update.channel_post;
        if (!msg) continue;
        
        messages.push({
          id: msg.message_id,
          updateId: update.update_id,
          text: msg.text || msg.caption || '',
          from: msg.from,
          chat: msg.chat,
          date: msg.date,
          timestamp: new Date(msg.date * 1000).toISOString(),
          type: update.edited_message ? 'edited' : 
                update.channel_post ? 'channel' : 'message',
          entities: msg.entities || [],
          reply_to_message: msg.reply_to_message,
          isBot: msg.from?.is_bot || false
        });
      }
    }
    
    return messages;
  }
}

// Singleton instance management for server-side
let serverInstance: TelegramPollingService | null = null;

export function getTelegramPollingService(botToken?: string): TelegramPollingService | null {
  if (typeof window !== 'undefined') {
    // Client-side: don't create service
    return null;
  }
  
  // Server-side: create/return singleton
  if (!serverInstance && botToken) {
    serverInstance = new TelegramPollingService(botToken);
  }
  
  return serverInstance;
}