'use client';

import { useQuery } from '@tanstack/react-query';
import { Bot, Wifi, WifiOff, Activity, AlertCircle, CheckCircle } from 'lucide-react';

interface BotStatus {
  bot: {
    id: number;
    username: string;
    first_name: string;
    can_join_groups?: boolean;
    can_read_all_group_messages?: boolean;
    supports_inline_queries?: boolean;
  } | null;
  webhook: {
    url: string;
    pending_update_count: number;
    last_error_date?: number;
    last_error_message?: string;
    last_synchronization_error_date?: number;
  } | null;
  status: {
    mode: 'polling' | 'webhook' | 'unknown';
    isHealthy: boolean;
    lastChecked: string;
  };
}

export function TelegramStatus() {
  const { data, isLoading, error, refetch } = useQuery<BotStatus>({
    queryKey: ['telegram-status'],
    queryFn: async () => {
      const botToken = process.env.NEXT_PUBLIC_TELEGRAM_BOT_TOKEN || '';
      
      // Get bot info
      let botInfo = null;
      try {
        const botResponse = await fetch('/api/telegram-bot-info');
        const botData = await botResponse.json();
        if (botData.bot) {
          botInfo = botData.bot;
        }
      } catch (error) {
        console.error('Failed to get bot info:', error);
      }
      
      // Get webhook info
      let webhookInfo = null;
      let mode: 'polling' | 'webhook' | 'unknown' = 'unknown';
      try {
        const webhookResponse = await fetch('/api/telegram-webhook-info');
        const webhookData = await webhookResponse.json();
        if (webhookData.webhook) {
          webhookInfo = webhookData.webhook;
          mode = webhookInfo.url ? 'webhook' : 'polling';
        }
      } catch (error) {
        console.error('Failed to get webhook info:', error);
      }
      
      const isHealthy = !webhookInfo?.last_error_message && 
                       (!webhookInfo?.pending_update_count || webhookInfo.pending_update_count < 100);
      
      return {
        bot: botInfo,
        webhook: webhookInfo,
        status: {
          mode,
          isHealthy,
          lastChecked: new Date().toISOString()
        }
      };
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  if (isLoading) {
    return (
      <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-lg shadow-xl border-4 border-red-500 p-6">
        <h2 className="text-3xl font-bebas text-red-600 mb-4 flex items-center gap-2 drop-shadow-md">
          <Bot className="h-6 w-6 text-red-600" />
          TELEGRAM BOT STATUS
        </h2>
        <div className="animate-pulse">
          <div className="h-20 bg-red-200 rounded" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-lg shadow-xl border-4 border-red-500 p-6">
        <h2 className="text-3xl font-bebas text-red-600 mb-4 flex items-center gap-2 drop-shadow-md">
          <Bot className="h-6 w-6 text-red-600" />
          TELEGRAM BOT STATUS
        </h2>
        <div className="flex items-center gap-2 text-red-700">
          <AlertCircle className="h-5 w-5" />
          <p className="text-sm font-russo">UNABLE TO FETCH STATUS</p>
        </div>
      </div>
    );
  }

  const { bot, webhook, status } = data;
  const botUsername = bot?.username;

  return (
    <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-lg shadow-xl border-4 border-red-500 p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-3xl font-bebas text-red-600 flex items-center gap-2 drop-shadow-md">
          <Bot className="h-6 w-6 text-red-600" />
          TELEGRAM BOT STATUS
          {botUsername && (
            <span className="text-sm font-russo text-red-700">
              @{botUsername}
            </span>
          )}
        </h2>
        <button 
          onClick={() => refetch()}
          className="text-xs font-russo text-red-600 hover:text-red-700 transition-colors px-2 py-1 border border-red-600 rounded"
        >
          REFRESH
        </button>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* Connection Status */}
        <div className="bg-red-50 border-2 border-red-400 rounded-lg p-3">
          <div className="flex items-center gap-2 text-red-600 mb-1">
            {status.isHealthy ? (
              <>
                <Wifi className="h-4 w-4 text-green-600" />
                <span className="text-xs font-russo">CONNECTED</span>
              </>
            ) : (
              <>
                <WifiOff className="h-4 w-4 text-red-600" />
                <span className="text-xs font-russo">DISCONNECTED</span>
              </>
            )}
          </div>
          <p className="text-lg font-bebas text-red-800">
            {status.mode.toUpperCase()} MODE
          </p>
          <p className="text-xs font-russo text-red-600">
            {status.isHealthy ? 'Bot is operational' : 'Bot may have issues'}
          </p>
        </div>

        {/* Bot Info */}
        <div className="bg-red-50 border-2 border-red-400 rounded-lg p-3">
          <div className="flex items-center gap-2 text-red-600 mb-1">
            <Activity className="h-4 w-4" />
            <span className="text-xs font-russo">BOT INFO</span>
          </div>
          <p className="text-lg font-bebas text-red-800">
            {bot?.first_name || 'Unknown'}
          </p>
          <p className="text-xs font-russo text-red-600">
            ID: {bot?.id || 'N/A'}
          </p>
        </div>

        {/* Health Status */}
        <div className="bg-red-50 border-2 border-red-400 rounded-lg p-3">
          <div className="flex items-center gap-2 text-red-600 mb-1">
            {status.isHealthy ? (
              <>
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-xs font-russo">HEALTHY</span>
              </>
            ) : (
              <>
                <AlertCircle className="h-4 w-4 text-yellow-600" />
                <span className="text-xs font-russo">WARNING</span>
              </>
            )}
          </div>
          <p className="text-lg font-bebas text-red-800">
            {webhook?.pending_update_count || 0} PENDING
          </p>
          <p className="text-xs font-russo text-red-600">
            Update queue
          </p>
        </div>
      </div>

      {/* Capabilities */}
      {bot && (
        <div className="bg-red-50 border-2 border-red-400 rounded-lg p-4 mb-4">
          <h3 className="text-lg font-bebas text-red-700 mb-2">BOT CAPABILITIES</h3>
          <div className="grid grid-cols-2 gap-2 text-xs font-russo">
            <div className="flex items-center gap-2">
              <span className={bot.can_join_groups ? 'text-green-600' : 'text-red-600'}>
                {bot.can_join_groups ? '✓' : '✗'}
              </span>
              <span className="text-red-700">Can join groups</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={bot.can_read_all_group_messages ? 'text-green-600' : 'text-red-600'}>
                {bot.can_read_all_group_messages ? '✓' : '✗'}
              </span>
              <span className="text-red-700">Read all group messages</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={bot.supports_inline_queries ? 'text-green-600' : 'text-red-600'}>
                {bot.supports_inline_queries ? '✓' : '✗'}
              </span>
              <span className="text-red-700">Inline queries</span>
            </div>
          </div>
        </div>
      )}

      {/* Error Info */}
      {webhook?.last_error_message && (
        <div className="bg-yellow-100 border-2 border-yellow-500 rounded-lg p-3">
          <p className="text-xs font-russo text-yellow-800">
            LAST ERROR: {webhook.last_error_message}
          </p>
          {webhook.last_error_date && (
            <p className="text-xs font-russo text-yellow-700">
              {new Date(webhook.last_error_date * 1000).toLocaleString()}
            </p>
          )}
        </div>
      )}

      {/* Important Note */}
      <div className="mt-4 pt-4 border-t-2 border-red-300">
        <p className="text-xs font-russo text-red-600">
          ⚠️ NOTE: Message history cannot be displayed while the bot is running. 
          Telegram API only allows one connection method at a time (polling OR webhook, not both).
        </p>
      </div>
    </div>
  );
}