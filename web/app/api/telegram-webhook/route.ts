import { NextResponse } from 'next/server';
import { telegramData, MAX_MESSAGES, MAX_ACTIVITIES } from '@/lib/telegram-store';

export async function POST(request: Request) {
  try {
    // Parse the webhook update from Telegram
    const update = await request.json();
    
    console.log('Received Telegram webhook:', JSON.stringify(update).substring(0, 200));
    
    // Extract message from various update types
    const msg = update.message || update.edited_message || update.channel_post || update.channel_post_edit;
    
    if (msg) {
      const messageId = `${msg.chat.id}_${msg.message_id}`;
      const username = msg.from?.username || msg.from?.first_name || 'Unknown';
      const isBot = msg.from?.is_bot || false;
      const messageTime = new Date(msg.date * 1000);
      
      // Store message
      telegramData.messages.set(messageId, {
        id: msg.message_id,
        chatId: msg.chat.id,
        text: msg.text || msg.caption || '',
        from: msg.from,
        chat: msg.chat,
        date: msg.date,
        timestamp: messageTime.toISOString(),
        isBot: isBot,
        entities: msg.entities || [],
        reply_to_message: msg.reply_to_message
      });
      
      // Keep only recent messages
      if (telegramData.messages.size > MAX_MESSAGES) {
        const messagesToKeep = Array.from(telegramData.messages.entries())
          .sort((a, b) => b[1].date - a[1].date)
          .slice(0, MAX_MESSAGES);
        telegramData.messages = new Map(messagesToKeep);
      }
      
      // Update metrics
      if (isBot) {
        telegramData.metrics.messagesSent++;
      } else {
        telegramData.metrics.messagesReceived++;
        telegramData.metrics.uniqueUsers.add(username);
        
        // Update user stats
        const userStat = telegramData.metrics.userMessages.get(username) || { count: 0, lastSeen: new Date() };
        userStat.count++;
        userStat.lastSeen = messageTime;
        telegramData.metrics.userMessages.set(username, userStat);
      }
      
      // Add to recent activity
      telegramData.metrics.recentActivity.push({
        time: messageTime.toISOString(),
        type: isBot ? 'message_sent' : 'message_received',
        description: msg.text ? msg.text.substring(0, 100) : 'No text',
        user: username,
        chatId: msg.chat.id,
        messageId: msg.message_id
      });
      
      // Keep only recent activities
      if (telegramData.metrics.recentActivity.length > MAX_ACTIVITIES) {
        telegramData.metrics.recentActivity = telegramData.metrics.recentActivity.slice(-MAX_ACTIVITIES);
      }
      
      telegramData.metrics.lastUpdate = messageTime;
    }
    
    // Handle callback queries (button presses)
    if (update.callback_query) {
      const query = update.callback_query;
      const username = query.from?.username || query.from?.first_name || 'Unknown';
      
      telegramData.metrics.recentActivity.push({
        time: new Date().toISOString(),
        type: 'callback_query',
        description: `Button pressed: ${query.data}`,
        user: username
      });
    }
    
    // Telegram expects a 200 OK response
    return NextResponse.json({ ok: true });
    
  } catch (error: any) {
    console.error('Webhook error:', error);
    // Still return 200 to prevent Telegram from retrying
    return NextResponse.json({ ok: true, error: error.message });
  }
}

// GET endpoint to check webhook status
export async function GET(request: Request) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  
  if (!botToken) {
    return NextResponse.json({ error: 'Bot token not configured' }, { status: 500 });
  }
  
  try {
    // Get current webhook info
    const response = await fetch(`https://api.telegram.org/bot${botToken}/getWebhookInfo`);
    const data = await response.json();
    
    if (!data.ok) {
      return NextResponse.json({ error: 'Failed to get webhook info', details: data }, { status: 500 });
    }
    
    // Add our stored data stats
    const stats = {
      webhook: data.result,
      storedMessages: telegramData.messages.size,
      totalMessagesSent: telegramData.metrics.messagesSent,
      totalMessagesReceived: telegramData.metrics.messagesReceived,
      uniqueUsers: telegramData.metrics.uniqueUsers.size,
      recentActivities: telegramData.metrics.recentActivity.length,
      lastUpdate: telegramData.metrics.lastUpdate.toISOString()
    };
    
    return NextResponse.json(stats);
    
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}