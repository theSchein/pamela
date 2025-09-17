'use client';

import { useQuery } from '@tanstack/react-query';
import { MessageCircle, Bot, Users, Activity, TrendingUp, Clock, AlertCircle } from 'lucide-react';
import { useState, useEffect } from 'react';

interface BotMetrics {
  bot: {
    id: number;
    username: string;
    first_name: string;
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
    webhookUrl?: string;
    pendingUpdateCount?: number;
  };
  recentActivity: {
    time: string;
    type: string;
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

export function TelegramMetrics() {
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update current time every second for relative timestamps
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const { data, isLoading, error, refetch } = useQuery<BotMetrics>({
    queryKey: ['telegram-metrics'],
    queryFn: async () => {
      const response = await fetch('/api/telegram-metrics');
      if (!response.ok) {
        throw new Error('Failed to fetch metrics');
      }
      return response.json();
    },
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  const getRelativeTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const seconds = Math.floor((currentTime.getTime() - date.getTime()) / 1000);
    
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  if (isLoading) {
    return (
      <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-lg shadow-xl border-4 border-red-500 p-6">
        <h2 className="text-3xl font-bebas text-red-600 mb-4 flex items-center gap-2 drop-shadow-md">
          <Bot className="h-6 w-6 text-red-600" />
          TELEGRAM BOT METRICS
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-20 bg-red-200 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-lg shadow-xl border-4 border-red-500 p-6">
        <h2 className="text-3xl font-bebas text-red-600 mb-4 flex items-center gap-2 drop-shadow-md">
          <Bot className="h-6 w-6 text-red-600" />
          TELEGRAM BOT METRICS
        </h2>
        <div className="flex items-center gap-2 text-red-700">
          <AlertCircle className="h-5 w-5" />
          <p className="text-sm font-russo">UNABLE TO FETCH METRICS</p>
        </div>
      </div>
    );
  }

  const stats = data.stats;
  const botUsername = data.bot?.username;

  return (
    <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-lg shadow-xl border-4 border-red-500 p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-3xl font-bebas text-red-600 flex items-center gap-2 drop-shadow-md">
          <Bot className="h-6 w-6 text-red-600" />
          TELEGRAM BOT METRICS
          {botUsername && (
            <span className="text-sm font-russo text-red-700">
              @{botUsername}
            </span>
          )}
        </h2>
        <div className="flex items-center gap-3">
          <span className="text-xs font-russo text-red-700">
            UPTIME: {stats.uptime}
          </span>
          <button 
            onClick={() => refetch()}
            className="text-xs font-russo text-red-600 hover:text-red-700 transition-colors px-2 py-1 border border-red-600 rounded"
          >
            REFRESH
          </button>
        </div>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-red-50 border-2 border-red-400 rounded-lg p-3">
          <div className="flex items-center gap-2 text-red-600 mb-1">
            <MessageCircle className="h-4 w-4" />
            <span className="text-xs font-russo">TOTAL MESSAGES</span>
          </div>
          <p className="text-2xl font-bebas text-red-800">{stats.totalMessages}</p>
          <p className="text-xs font-russo text-red-600">
            {stats.messagesLastHour} last hour
          </p>
        </div>

        <div className="bg-red-50 border-2 border-red-400 rounded-lg p-3">
          <div className="flex items-center gap-2 text-red-600 mb-1">
            <Users className="h-4 w-4" />
            <span className="text-xs font-russo">UNIQUE USERS</span>
          </div>
          <p className="text-2xl font-bebas text-red-800">{stats.uniqueUsers}</p>
          <p className="text-xs font-russo text-red-600">
            {stats.activeChats} active
          </p>
        </div>

        <div className="bg-red-50 border-2 border-red-400 rounded-lg p-3">
          <div className="flex items-center gap-2 text-red-600 mb-1">
            <TrendingUp className="h-4 w-4" />
            <span className="text-xs font-russo">24H ACTIVITY</span>
          </div>
          <p className="text-2xl font-bebas text-red-800">{stats.messagesLast24Hours}</p>
          <p className="text-xs font-russo text-red-600">
            messages
          </p>
        </div>

        <div className="bg-red-50 border-2 border-red-400 rounded-lg p-3">
          <div className="flex items-center gap-2 text-red-600 mb-1">
            <Activity className="h-4 w-4" />
            <span className="text-xs font-russo">RESPONSE RATE</span>
          </div>
          <p className="text-2xl font-bebas text-red-800">
            {stats.responseRate.toFixed(0)}%
          </p>
          <p className="text-xs font-russo text-red-600">
            {stats.lastActivityTime ? getRelativeTime(stats.lastActivityTime) : 'N/A'}
          </p>
        </div>
      </div>

      {/* Two column layout for activity and users */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Recent Activity */}
        <div className="bg-red-50 border-2 border-red-400 rounded-lg p-4">
          <h3 className="text-lg font-bebas text-red-700 mb-3 flex items-center gap-2">
            <Clock className="h-4 w-4" />
            RECENT ACTIVITY
          </h3>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {data.recentActivity.length === 0 ? (
              <p className="text-xs font-russo text-red-600">No recent activity</p>
            ) : (
              data.recentActivity.map((activity, index) => (
                <div key={index} className="text-xs font-russo text-red-700 border-b border-red-200 pb-1">
                  <div className="flex justify-between">
                    <span className="font-semibold">
                      {activity.type.replace(/_/g, ' ').toUpperCase()}
                    </span>
                    <span className="text-red-500">
                      {getRelativeTime(activity.time)}
                    </span>
                  </div>
                  {activity.user && (
                    <span className="text-red-600">User: {activity.user}</span>
                  )}
                  {activity.description && (
                    <p className="text-red-600 truncate">{activity.description}</p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Top Users */}
        <div className="bg-red-50 border-2 border-red-400 rounded-lg p-4">
          <h3 className="text-lg font-bebas text-red-700 mb-3 flex items-center gap-2">
            <Users className="h-4 w-4" />
            TOP USERS
          </h3>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {data.userStats.length === 0 ? (
              <p className="text-xs font-russo text-red-600">No user data available</p>
            ) : (
              data.userStats.map((user, index) => (
                <div key={index} className="flex justify-between items-center text-xs font-russo border-b border-red-200 pb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-red-800 font-semibold">
                      {index + 1}. {user.username}
                    </span>
                    {user.isActive && (
                      <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" title="Active" />
                    )}
                  </div>
                  <div className="text-right">
                    <span className="text-red-700">{user.messageCount} msgs</span>
                    <span className="text-red-500 ml-2">
                      {getRelativeTime(user.lastSeen)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Status Bar */}
      <div className="mt-4 pt-4 border-t-2 border-red-300">
        <div className="flex justify-between items-center text-xs font-russo text-red-600">
          <div className="flex items-center gap-4">
            <span>BOT STATUS: {stats.pendingUpdateCount === 0 ? 'HEALTHY' : 'PENDING UPDATES'}</span>
            {stats.webhookUrl && (
              <span>MODE: {stats.webhookUrl === 'Not configured' ? 'POLLING' : 'WEBHOOK'}</span>
            )}
          </div>
          <span>STARTED: {new Date(stats.startTime).toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
}