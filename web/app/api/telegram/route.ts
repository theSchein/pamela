import { NextResponse } from 'next/server';

// In-memory storage for message tracking (no database)
let messageCache = new Map<string, any>(); // Use Map to avoid duplicates
const MAX_CACHE_SIZE = 200;
let lastFetchTime = 0;

export async function GET(request: Request) {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    
    if (!botToken) {
      return NextResponse.json({ error: 'Telegram bot token not configured' }, { status: 500 });
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const resetCache = searchParams.get('resetCache') === 'true';
    const getAllHistory = searchParams.get('getAllHistory') === 'true';
    
    // Reset cache if requested
    if (resetCache) {
      messageCache.clear();
      lastFetchTime = 0;
    }

    // Get bot info first
    const botInfoResponse = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
    const botInfo = await botInfoResponse.json();

    if (!botInfo.ok) {
      return NextResponse.json({ error: 'Failed to get bot info' }, { status: 500 });
    }

    // Fetch updates
    let updates = { ok: true, result: [] };
    const now = Date.now();
    
    // Always try to fetch messages
    try {
      // No offset = get all pending messages
      const params = new URLSearchParams({
        limit: '100'
        // NO offset parameter - this gets ALL pending updates
      });
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout
      
      const updatesResponse = await fetch(
        `https://api.telegram.org/bot${botToken}/getUpdates?${params}`,
        { signal: controller.signal }
      );
      
      clearTimeout(timeoutId);
      
      if (updatesResponse.ok) {
        updates = await updatesResponse.json();
        lastFetchTime = now;
        
        // Log what we got
        console.log(`Telegram API: Got ${updates.result?.length || 0} updates`);
      }
    } catch (err: any) {
      console.log('Telegram fetch error, using cache:', err.message);
    }

    if (!updates.ok) {
      return NextResponse.json({ error: 'Failed to get updates' }, { status: 500 });
    }

    // Process all updates
    if (updates.result && updates.result.length > 0) {
      // Process ALL messages, including bot responses
      updates.result.forEach((update: any) => {
        const msg = update.message || update.edited_message || update.channel_post;
        if (!msg) return;
        
        // Create unique key for each message
        const messageKey = `${msg.chat.id}_${msg.message_id}`;
        
        // Store message with all details
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
        
        // Add or update in cache
        messageCache.set(messageKey, processedMessage);
      });
      
      // Limit cache size
      if (messageCache.size > MAX_CACHE_SIZE) {
        const entries = Array.from(messageCache.entries());
        const toKeep = entries.slice(-MAX_CACHE_SIZE);
        messageCache = new Map(toKeep);
      }
    }
    
    // Get all messages and sort by date (oldest first for conversation flow)
    const allMessages = Array.from(messageCache.values())
      .sort((a, b) => a.date - b.date); // Changed to ascending order for conversation flow

    return NextResponse.json({
      bot: {
        id: botInfo.result.id,
        username: botInfo.result.username,
        first_name: botInfo.result.first_name
      },
      messages: allMessages,
      meta: {
        totalMessages: messageCache.size,
        newMessages: updates.result?.length || 0,
        lastFetch: new Date(lastFetchTime).toISOString(),
        status: 'ok'
      }
    });
  } catch (error: any) {
    console.error('Telegram API error:', error.message || error);
    
    // Return empty but valid structure (don't fail the request)
    return NextResponse.json({ 
      bot: null,
      messages: Array.from(messageCache.values()).sort((a, b) => a.date - b.date),
      meta: {
        totalMessages: messageCache.size,
        newMessages: 0,
        lastFetch: lastFetchTime ? new Date(lastFetchTime).toISOString() : null,
        status: 'error',
        error: error.message || 'Unknown error'
      }
    });
  }
}