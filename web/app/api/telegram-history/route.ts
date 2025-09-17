import { NextResponse } from 'next/server';

// This endpoint fetches recent chat history without using getUpdates
// It uses getChatHistory or searches for messages to avoid conflicts with the bot's polling

export async function GET(request: Request) {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    
    if (!botToken) {
      return NextResponse.json({ error: 'Telegram bot token not configured' }, { status: 500 });
    }

    // Get bot info first
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

    // Unfortunately, Telegram Bot API doesn't provide getChatHistory
    // We need to use a different approach - perhaps webhooks or a shared database
    
    // For now, return empty with explanation
    return NextResponse.json({
      bot: botInfo,
      messages: [],
      meta: {
        status: 'monitor-mode',
        note: 'To avoid conflicts with the bot, the web monitor needs a different data source',
        suggestion: 'Consider using webhooks or a shared database for message history'
      }
    });
    
  } catch (error: any) {
    console.error('Telegram history API error:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to fetch Telegram history',
      suggestion: 'The web monitor should not poll getUpdates to avoid conflicts with the bot'
    }, { status: 500 });
  }
}