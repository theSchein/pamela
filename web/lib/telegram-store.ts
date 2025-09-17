// Shared storage for Telegram webhook data
// In production, this should be in a database

export const telegramData = {
  messages: new Map<string, any>(),
  metrics: {
    messagesSent: 0,
    messagesReceived: 0,
    uniqueUsers: new Set<string>(),
    recentActivity: [] as any[],
    userMessages: new Map<string, { count: number; lastSeen: Date }>(),
    startTime: new Date(),
    lastUpdate: new Date(),
    botInfo: null as any
  }
};

// Maximum number of messages to keep in memory
export const MAX_MESSAGES = 500;
export const MAX_ACTIVITIES = 100;