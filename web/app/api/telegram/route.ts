import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

// Persistent offset storage location
const OFFSET_FILE = path.join(process.cwd(), '.telegram-offset');

// Global state for offset tracking
let currentOffset = 0;
let messageBuffer = new Map<string, any>();
const MAX_BUFFER_SIZE = 500;

// Prevent concurrent polling
let isPolling = false;
let lastPollTime = 0;
const MIN_POLL_INTERVAL = 1000; // Minimum 1 second between polls

// Load saved offset from file
async function loadSavedOffset(): Promise<number> {
  try {
    const data = await fs.readFile(OFFSET_FILE, 'utf-8');
    return parseInt(data, 10) || 0;
  } catch {
    return 0;
  }
}

// Save offset to file
async function saveOffset(offset: number): Promise<void> {
  try {
    await fs.writeFile(OFFSET_FILE, offset.toString());
  } catch (error) {
    console.error('Failed to save offset:', error);
  }
}

// Initialize offset on first load
let offsetInitialized = false;
async function initializeOffset() {
  if (!offsetInitialized) {
    currentOffset = await loadSavedOffset();
    offsetInitialized = true;
    console.log(`Initialized Telegram offset: ${currentOffset}`);
  }
}

export async function GET(request: Request) {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    
    if (!botToken) {
      return NextResponse.json({ error: 'Telegram bot token not configured' }, { status: 500 });
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const reset = searchParams.get('reset') === 'true';
    const longPoll = searchParams.get('longPoll') === 'true';
    const limit = parseInt(searchParams.get('limit') || '100');
    const monitorOnly = searchParams.get('monitorOnly') !== 'false'; // Default to true
    
    // IMPORTANT: In monitor-only mode, we don't poll Telegram directly
    // to avoid conflicts with the bot. Instead, return cached data only.
    if (monitorOnly && !reset) {
      // Just return cached messages without polling
      const messages = Array.from(messageBuffer.values())
        .sort((a, b) => b.date - a.date)
        .slice(0, limit);
      
      // Get bot info from cache or fetch once
      let botInfo = null;
      try {
        const botInfoResponse = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
        const botData = await botInfoResponse.json();
        if (botData.ok) {
          botInfo = {
            id: botData.result.id,
            username: botData.result.username,
            first_name: botData.result.first_name
          };
        }
      } catch (error) {
        console.error('Failed to get bot info:', error);
      }
      
      return NextResponse.json({
        bot: botInfo,
        messages,
        meta: {
          offset: -1,
          bufferSize: messageBuffer.size,
          totalMessages: messages.length,
          status: 'monitor-only',
          monitorOnly: true,
          note: 'Monitor-only mode - not polling to avoid conflicts with bot'
        }
      });
    }
    
    // Initialize offset (skip for monitor-only mode which is default)
    if (!monitorOnly) {
      await initializeOffset();
    }
    
    // Reset if requested
    if (reset) {
      currentOffset = 0;
      messageBuffer.clear();
      await saveOffset(0);
    }
    
    // Fetch updates from Telegram with conflict prevention
    const fetchUpdates = async (timeout: number = 0, monitorMode: boolean = false): Promise<any> => {
      // Check if we're already polling (for long polls)
      if (timeout > 0) {
        if (isPolling) {
          console.log('Skipping poll - another poll is in progress');
          return { ok: true, result: [] };
        }
        isPolling = true;
      }
      
      // Ensure minimum interval between polls
      const now = Date.now();
      const timeSinceLastPoll = now - lastPollTime;
      if (timeSinceLastPoll < MIN_POLL_INTERVAL) {
        await new Promise(resolve => setTimeout(resolve, MIN_POLL_INTERVAL - timeSinceLastPoll));
      }
      
      // In monitor-only mode, use offset -1 to not consume messages
      const offsetToUse = monitorMode ? '-1' : currentOffset.toString();
      
      const params = new URLSearchParams({
        offset: offsetToUse,
        limit: '100',
        timeout: timeout.toString(),
        allowed_updates: JSON.stringify(['message', 'edited_message', 'channel_post'])
      });
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), (timeout + 5) * 1000);
      
      try {
        lastPollTime = Date.now();
        const response = await fetch(
          `https://api.telegram.org/bot${botToken}/getUpdates?${params}`,
          { signal: controller.signal }
        );
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          // Handle 409 Conflict specifically
          if (response.status === 409) {
            const errorData = await response.json();
            console.warn('Telegram API conflict:', errorData.description);
            // Return empty result, don't throw
            return { ok: true, result: [] };
          }
          
          const errorText = await response.text();
          throw new Error(`Telegram API error ${response.status}: ${errorText}`);
        }
        
        return await response.json();
      } catch (error: any) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
          return { ok: true, result: [] };
        }
        throw error;
      } finally {
        if (timeout > 0) {
          isPolling = false;
        }
      }
    };
    
    // Process updates  
    const processUpdates = (updates: any[], skipOffsetUpdate: boolean = false) => {
      const newMessages: any[] = [];
      
      for (const update of updates) {
        const msg = update.message || update.edited_message || update.channel_post;
        if (!msg) continue;
        
        const messageKey = `${msg.chat.id}_${msg.message_id}`;
        
        // Create processed message
        const processedMessage = {
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
          isBot: msg.from?.is_bot || false
        };
        
        // Check if this is a new message
        if (!messageBuffer.has(messageKey) || update.edited_message) {
          messageBuffer.set(messageKey, processedMessage);
          newMessages.push(processedMessage);
        }
        
        // Update offset (skip if requested)
        if (!skipOffsetUpdate && update.update_id >= currentOffset) {
          currentOffset = update.update_id + 1;
        }
      }
      
      // Trim buffer if needed
      if (messageBuffer.size > MAX_BUFFER_SIZE) {
        const entries = Array.from(messageBuffer.entries())
          .sort((a, b) => b[1].date - a[1].date)
          .slice(0, MAX_BUFFER_SIZE);
        messageBuffer = new Map(entries);
      }
      
      return newMessages;
    };
    
    // Handle long polling request
    if (longPoll) {
      try {
        const data = await fetchUpdates(25, monitorOnly); // 25 second timeout
        
        if (!data.ok) {
          // Don't treat as error, just return empty
          console.warn('Telegram API returned not ok:', data.description);
          return NextResponse.json({
            messages: [],
            meta: {
              offset: currentOffset,
              bufferSize: messageBuffer.size,
              status: 'timeout',
              timeout: true
            }
          });
        }
        
        const newMessages = data.result ? processUpdates(data.result, monitorOnly) : [];
        if (!monitorOnly && newMessages.length > 0) {
          await saveOffset(currentOffset);
        }
        
        return NextResponse.json({
          messages: newMessages,
          meta: {
            offset: currentOffset,
            bufferSize: messageBuffer.size,
            newMessages: newMessages.length,
            status: newMessages.length > 0 ? 'new_messages' : 'timeout',
            timeout: newMessages.length === 0
          }
        });
      } catch (error: any) {
        console.error('Long polling error:', error.message);
        // Don't return error status to client, just timeout
        return NextResponse.json({
          messages: [],
          meta: {
            offset: currentOffset,
            bufferSize: messageBuffer.size,
            status: 'timeout',
            timeout: true
          }
        });
      }
    }
    
    // Regular request - fetch with no timeout
    try {
      const data = await fetchUpdates(0, monitorOnly);
      
      if (data.ok && data.result) {
        processUpdates(data.result, monitorOnly);
        if (!monitorOnly) {
          await saveOffset(currentOffset);
        }
      }
    } catch (error: any) {
      console.warn('Failed to fetch updates:', error.message);
      // Continue with cached data
    }
    
    // Get bot info
    let botInfo = null;
    try {
      const botInfoResponse = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
      const botData = await botInfoResponse.json();
      if (botData.ok) {
        botInfo = {
          id: botData.result.id,
          username: botData.result.username,
          first_name: botData.result.first_name
        };
      }
    } catch (error) {
      console.error('Failed to get bot info:', error);
    }
    
    // Get messages from buffer
    const messages = Array.from(messageBuffer.values())
      .sort((a, b) => b.date - a.date)
      .slice(0, limit);

    return NextResponse.json({
      bot: botInfo,
      messages,
      meta: {
        offset: currentOffset,
        bufferSize: messageBuffer.size,
        totalMessages: messages.length,
        status: 'ok'
      }
    });
    
  } catch (error: any) {
    console.error('Telegram API error:', error);
    
    // Return cached messages on error
    const messages = Array.from(messageBuffer.values())
      .sort((a, b) => b.date - a.date)
      .slice(0, 100);
    
    return NextResponse.json({ 
      bot: null,
      messages,
      meta: {
        offset: currentOffset,
        bufferSize: messageBuffer.size,
        totalMessages: messages.length,
        status: 'error',
        error: error.message || 'Unknown error'
      }
    });
  }
}