import { NextResponse } from 'next/server';
import { telegramData } from '@/lib/telegram-store';

interface BotMetrics {
  bot: {
    id: number;
    username: string;
    first_name: string;
    can_join_groups?: boolean;
    can_read_all_group_messages?: boolean;
    supports_inline_queries?: boolean;
  } | null;
  stats: {
    totalChats: number;
    activeChats: number;
    totalMessages: number;
    messagesLastHour: number;
    messagesLast24Hours: number;
    uniqueUsers: number;
    responseRate: number;
    averageResponseTime: string;
    lastActivityTime: string | null;
    uptime: string;
    startTime: string;
  };
  recentActivity: {
    time: string;
    type: 'message_sent' | 'message_received' | 'new_user' | 'error';
    description: string;
    user?: string;
  }[];
  userStats: {
    username: string;
    messageCount: number;
    lastSeen: string;
    isActive: boolean;
  }[];
}

// In-memory storage for metrics (in production, this would be in a database)
let metricsCache: {
  messagesSent: number;
  messagesReceived: number;
  uniqueUsers: Set<string>;
  recentActivity: any[];
  userMessages: Map<string, { count: number; lastSeen: Date }>;
  startTime: Date;
  lastUpdate: Date;
  lastFetchTime: Date;
  seenMessageIds: Set<number>;
} = {
  messagesSent: 0,
  messagesReceived: 0,
  uniqueUsers: new Set(),
  recentActivity: [],
  userMessages: new Map(),
  startTime: new Date(),
  lastUpdate: new Date(),
  lastFetchTime: new Date(0),
  seenMessageIds: new Set()
};

export async function GET(request: Request) {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    
    if (!botToken) {
      return NextResponse.json({ error: 'Telegram bot token not configured' }, { status: 500 });
    }

    // Get bot information
    let botInfo = null;
    try {
      const botResponse = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
      const botData = await botResponse.json();
      if (botData.ok) {
        botInfo = botData.result;
      }
    } catch (error) {
      console.error('Failed to get bot info:', error);
    }

    // Note: We cannot fetch message history because:
    // 1. Using getUpdates conflicts with the bot's polling (409 error)
    // 2. Using webhooks prevents the bot from polling (409 error)
    // 3. Telegram doesn't provide a getChatHistory endpoint
    const now = new Date();

    // Get webhook info to check bot status
    let webhookInfo = null;
    try {
      const webhookResponse = await fetch(`https://api.telegram.org/bot${botToken}/getWebhookInfo`);
      const webhookData = await webhookResponse.json();
      if (webhookData.ok) {
        webhookInfo = webhookData.result;
      }
    } catch (error) {
      console.error('Failed to get webhook info:', error);
    }

    // Calculate metrics
    const uptime = now.getTime() - metricsCache.startTime.getTime();
    const uptimeHours = Math.floor(uptime / (1000 * 60 * 60));
    const uptimeMinutes = Math.floor((uptime % (1000 * 60 * 60)) / (1000 * 60));

    // Get user stats
    const userStats = Array.from(metricsCache.userMessages.entries())
      .map(([username, data]) => ({
        username,
        messageCount: data.count,
        lastSeen: data.lastSeen.toISOString(),
        isActive: (now.getTime() - data.lastSeen.getTime()) < 3600000 // Active in last hour
      }))
      .sort((a, b) => b.messageCount - a.messageCount)
      .slice(0, 10); // Top 10 users

    // Prepare metrics response
    const metrics: BotMetrics = {
      bot: botInfo,
      stats: {
        totalChats: metricsCache.uniqueUsers.size,
        activeChats: userStats.filter(u => u.isActive).length,
        totalMessages: metricsCache.messagesSent + metricsCache.messagesReceived,
        messagesLastHour: metricsCache.recentActivity
          .filter(a => new Date(a.time).getTime() > now.getTime() - 3600000).length,
        messagesLast24Hours: metricsCache.recentActivity
          .filter(a => new Date(a.time).getTime() > now.getTime() - 86400000).length,
        uniqueUsers: metricsCache.uniqueUsers.size,
        responseRate: metricsCache.messagesReceived > 0 
          ? (metricsCache.messagesSent / metricsCache.messagesReceived) * 100 
          : 0,
        averageResponseTime: 'N/A', // Would need message timestamps to calculate
        lastActivityTime: metricsCache.lastUpdate.toISOString(),
        uptime: `${uptimeHours}h ${uptimeMinutes}m`,
        startTime: metricsCache.startTime.toISOString()
      },
      recentActivity: metricsCache.recentActivity.slice(-20).reverse(), // Last 20 activities
      userStats
    };

    // Add webhook status info
    if (webhookInfo) {
      metrics.stats = {
        ...metrics.stats,
        // @ts-ignore
        webhookUrl: webhookInfo.url || 'Not configured',
        lastErrorDate: webhookInfo.last_error_date 
          ? new Date(webhookInfo.last_error_date * 1000).toISOString() 
          : null,
        lastErrorMessage: webhookInfo.last_error_message || null,
        pendingUpdateCount: webhookInfo.pending_update_count || 0
      };
    }

    return NextResponse.json(metrics);
    
  } catch (error: any) {
    console.error('Telegram metrics API error:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to fetch Telegram metrics' 
    }, { status: 500 });
  }
}

// POST endpoint to update metrics (would be called by the bot)
export async function POST(request: Request) {
  try {
    const data = await request.json();
    
    if (data.type === 'message_sent') {
      metricsCache.messagesSent++;
    } else if (data.type === 'message_received') {
      metricsCache.messagesReceived++;
      if (data.username) {
        metricsCache.uniqueUsers.add(data.username);
        const userStat = metricsCache.userMessages.get(data.username) || { count: 0, lastSeen: new Date() };
        userStat.count++;
        userStat.lastSeen = new Date();
        metricsCache.userMessages.set(data.username, userStat);
      }
    }

    // Add to recent activity
    metricsCache.recentActivity.push({
      time: new Date().toISOString(),
      type: data.type,
      description: data.description || '',
      user: data.username
    });

    // Keep only last 100 activities
    if (metricsCache.recentActivity.length > 100) {
      metricsCache.recentActivity = metricsCache.recentActivity.slice(-100);
    }

    metricsCache.lastUpdate = new Date();

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}