import { NextResponse } from 'next/server';

// Alternative webhook endpoint for receiving Telegram updates
// This can be used if long polling is unreliable

// Store recent webhook updates in memory
const webhookMessages: any[] = [];
const MAX_WEBHOOK_MESSAGES = 100;

export async function POST(request: Request) {
  try {
    const update = await request.json();
    
    // Process the update
    if (update.message || update.edited_message || update.channel_post) {
      const msg = update.message || update.edited_message || update.channel_post;
      
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
        receivedAt: new Date().toISOString()
      };
      
      // Add to webhook messages
      webhookMessages.unshift(processedMessage);
      
      // Keep size under control
      if (webhookMessages.length > MAX_WEBHOOK_MESSAGES) {
        webhookMessages.length = MAX_WEBHOOK_MESSAGES;
      }
    }
    
    // Telegram expects a 200 OK response
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

// GET endpoint to retrieve webhook messages
export async function GET() {
  return NextResponse.json({
    messages: webhookMessages,
    count: webhookMessages.length,
    timestamp: new Date().toISOString()
  });
}