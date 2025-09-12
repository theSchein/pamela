import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    
    if (!botToken) {
      return NextResponse.json({ error: 'Telegram bot token not configured' }, { status: 500 });
    }

    // Get bot info first
    const botInfoResponse = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
    const botInfo = await botInfoResponse.json();

    if (!botInfo.ok) {
      return NextResponse.json({ error: 'Failed to get bot info' }, { status: 500 });
    }

    // Get updates (recent messages)
    const updatesResponse = await fetch(`https://api.telegram.org/bot${botToken}/getUpdates?limit=100`);
    const updates = await updatesResponse.json();

    if (!updates.ok) {
      return NextResponse.json({ error: 'Failed to get updates' }, { status: 500 });
    }

    // Process messages - filter for actual messages from users
    const messages = updates.result
      .filter((update: any) => update.message)
      .map((update: any) => ({
        id: update.message.message_id,
        text: update.message.text,
        from: update.message.from,
        chat: update.message.chat,
        date: update.message.date,
        timestamp: new Date(update.message.date * 1000).toISOString()
      }))
      .reverse(); // Most recent first

    return NextResponse.json({
      bot: {
        id: botInfo.result.id,
        username: botInfo.result.username,
        first_name: botInfo.result.first_name
      },
      messages
    });
  } catch (error) {
    console.error('Telegram API error:', error);
    return NextResponse.json({ error: 'Failed to fetch Telegram data' }, { status: 500 });
  }
}