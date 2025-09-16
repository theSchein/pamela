'use client';

import { useState } from 'react';
import { useFullHistory } from '@/hooks/useFullHistory';
import { formatCurrency, timeAgo } from '@/lib/utils';
import { Trophy, TrendingDown, DollarSign, Loader2, Activity } from 'lucide-react';

interface TradeHistoryProps {
  walletAddress: string;
}

export function TradeHistoryV2({ walletAddress }: TradeHistoryProps) {
  const [filter, setFilter] = useState<'all' | 'open' | 'closed' | 'wins' | 'losses'>('all');
  
  const { data: fullHistoryData, isLoading, error } = useFullHistory(walletAddress);
  
  const history = fullHistoryData?.history || [];
  const stats = fullHistoryData?.stats || {};
  
  // Filter transactions based on selection
  const filteredHistory = history.filter((item: any) => {
    if (filter === 'all') return true;
    if (filter === 'open') return item.type === 'position' && item.status === 'open';
    if (filter === 'closed') return item.type === 'closed_position';
    if (filter === 'wins') return item.type === 'closed_position' && item.status === 'won';
    if (filter === 'losses') return item.type === 'closed_position' && item.status === 'lost';
    return false;
  });

  // Count items for each filter
  const counts = {
    all: history.length,
    open: history.filter((h: any) => h.type === 'position' && h.status === 'open').length,
    closed: history.filter((h: any) => h.type === 'closed_position').length,
    wins: history.filter((h: any) => h.type === 'closed_position' && h.status === 'won').length,
    losses: history.filter((h: any) => h.type === 'closed_position' && h.status === 'lost').length,
  };

  if (isLoading) {
    return (
      <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-lg shadow-xl border-4 border-red-500 p-6">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-red-600" />
          <span className="ml-2 text-red-600 font-russo">LOADING HISTORY...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-lg shadow-xl border-4 border-red-500 p-6">
        <p className="text-red-600">Error loading trade history</p>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-lg shadow-xl border-4 border-red-500 p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bebas text-red-600 drop-shadow-md">
          TRADING HISTORY
        </h2>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded font-russo text-sm transition-colors ${
              filter === 'all' 
                ? 'bg-red-600 text-yellow-100' 
                : 'bg-yellow-200 text-red-700 hover:bg-yellow-300'
            }`}
          >
            ALL ({counts.all})
          </button>
          <button
            onClick={() => setFilter('open')}
            className={`px-4 py-2 rounded font-russo text-sm transition-colors ${
              filter === 'open' 
                ? 'bg-blue-600 text-white' 
                : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
            }`}
          >
            📊 OPEN ({counts.open})
          </button>
          <button
            onClick={() => setFilter('closed')}
            className={`px-4 py-2 rounded font-russo text-sm transition-colors ${
              filter === 'closed' 
                ? 'bg-gray-600 text-white' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            📁 CLOSED ({counts.closed})
          </button>
          <button
            onClick={() => setFilter('wins')}
            className={`px-4 py-2 rounded font-russo text-sm transition-colors ${
              filter === 'wins' 
                ? 'bg-amber-600 text-white' 
                : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
            }`}
          >
            🏆 WINS ({counts.wins})
          </button>
          <button
            onClick={() => setFilter('losses')}
            className={`px-4 py-2 rounded font-russo text-sm transition-colors ${
              filter === 'losses' 
                ? 'bg-red-600 text-white' 
                : 'bg-red-100 text-red-700 hover:bg-red-200'
            }`}
          >
            💀 LOSSES ({counts.losses})
          </button>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-50 border-2 border-blue-400 rounded-lg p-3">
          <p className="text-blue-700 font-russo uppercase text-xs">Open Positions</p>
          <p className="text-2xl font-bebas text-blue-600">{stats.totalPositions || 0}</p>
        </div>
        <div className="bg-gray-50 border-2 border-gray-400 rounded-lg p-3">
          <p className="text-gray-700 font-russo uppercase text-xs">Closed Positions</p>
          <p className="text-2xl font-bebas text-gray-600">{stats.totalClosedPositions || 0}</p>
        </div>
        <div className="bg-emerald-50 border-2 border-emerald-400 rounded-lg p-3">
          <p className="text-emerald-700 font-russo uppercase text-xs">Realized P&L</p>
          <p className={`text-2xl font-bebas ${stats.totalRealizedPnl >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {stats.totalRealizedPnl >= 0 ? '+' : ''}{formatCurrency(stats.totalRealizedPnl || 0)}
          </p>
        </div>
        <div className="bg-yellow-100 border-2 border-yellow-400 rounded-lg p-3">
          <p className="text-yellow-700 font-russo uppercase text-xs">Unrealized P&L</p>
          <p className={`text-2xl font-bebas ${stats.totalUnrealizedPnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {stats.totalUnrealizedPnl >= 0 ? '+' : ''}{formatCurrency(stats.totalUnrealizedPnl || 0)}
          </p>
        </div>
      </div>

      {/* Transaction List */}
      <div className="space-y-2 max-h-[600px] overflow-y-auto">
        {filteredHistory.length === 0 ? (
          <div className="text-center py-8 text-red-600 font-russo">
            No transactions found
          </div>
        ) : (
          filteredHistory.map((item: any, index: number) => {
            const isOpen = item.type === 'position' && item.status === 'open';
            const isClosed = item.type === 'closed_position';
            const isRedemption = item.type === 'redemption';
            const isWin = item.status === 'won';
            const isLoss = item.status === 'lost';
            
            return (
              <div
                key={item.id || index}
                className={`border-2 rounded-lg p-4 hover:shadow-lg transition-shadow ${
                  isRedemption ? 'bg-emerald-50 border-emerald-400' :
                  isWin ? 'bg-amber-50 border-amber-400' :
                  isLoss ? 'bg-red-50 border-red-400' :
                  isOpen ? 'bg-blue-50 border-blue-400' :
                  'bg-gray-50 border-gray-400'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      {isRedemption ? (
                        <>
                          <DollarSign className="w-5 h-5 text-emerald-600" />
                          <span className="font-russo uppercase text-sm text-emerald-600">
                            REDEEMED
                          </span>
                        </>
                      ) : isWin ? (
                        <>
                          <Trophy className="w-5 h-5 text-amber-600" />
                          <span className="font-russo uppercase text-sm text-amber-600">
                            WON
                          </span>
                        </>
                      ) : isLoss ? (
                        <>
                          <TrendingDown className="w-5 h-5 text-red-600" />
                          <span className="font-russo uppercase text-sm text-red-600">
                            LOST
                          </span>
                        </>
                      ) : isOpen ? (
                        <>
                          <Activity className="w-5 h-5 text-blue-600" />
                          <span className="font-russo uppercase text-sm text-blue-600">
                            OPEN
                          </span>
                        </>
                      ) : (
                        <>
                          <Activity className="w-5 h-5 text-gray-600" />
                          <span className="font-russo uppercase text-sm text-gray-600">
                            CLOSED
                          </span>
                        </>
                      )}
                      <span className="text-gray-600 text-sm">•</span>
                      <span className="text-gray-600 text-sm font-mono">
                        {timeAgo(item.timestamp || item.endDate)}
                      </span>
                    </div>
                    <p className="text-gray-900 font-medium mb-1 line-clamp-2">
                      {item.marketQuestion || 'Market Position'}
                    </p>
                    <div className="flex items-center gap-4 text-sm">
                      {item.outcome && (
                        <span className="text-gray-600">
                          Outcome: <span className="font-semibold">{item.outcome}</span>
                        </span>
                      )}
                      {item.size && parseFloat(item.size) > 0 && (
                        <span className="text-gray-600">
                          Size: <span className="font-semibold">{parseFloat(item.size).toFixed(2)}</span>
                        </span>
                      )}
                      {item.avgPrice && (
                        <span className="text-gray-600">
                          Avg Price: <span className="font-semibold">${parseFloat(item.avgPrice).toFixed(4)}</span>
                        </span>
                      )}
                      {item.totalBought && (
                        <span className="text-gray-600">
                          Bought: <span className="font-semibold">{formatCurrency(item.totalBought)}</span>
                        </span>
                      )}
                      {item.totalSold && (
                        <span className="text-gray-600">
                          Sold: <span className="font-semibold">{formatCurrency(item.totalSold)}</span>
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    {isRedemption ? (
                      <>
                        <p className="text-2xl font-bebas text-emerald-600">
                          +{formatCurrency(item.amount || 0)}
                        </p>
                        <p className="text-xs text-gray-600 font-russo">CLAIMED</p>
                      </>
                    ) : isOpen ? (
                      <>
                        <p className={`text-2xl font-bebas ${item.unrealizedPnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {item.unrealizedPnl >= 0 ? '+' : ''}{formatCurrency(item.unrealizedPnl || 0)}
                        </p>
                        <p className="text-xs text-gray-600 font-russo">UNREALIZED</p>
                        {item.percentPnl && (
                          <p className={`text-sm font-mono ${item.percentPnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {item.percentPnl >= 0 ? '+' : ''}{item.percentPnl.toFixed(2)}%
                          </p>
                        )}
                      </>
                    ) : isClosed ? (
                      <>
                        <p className={`text-2xl font-bebas ${item.realizedPnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {item.realizedPnl >= 0 ? '+' : ''}{formatCurrency(item.realizedPnl || 0)}
                        </p>
                        <p className="text-xs text-gray-600 font-russo">REALIZED</p>
                      </>
                    ) : null}
                  </div>
                </div>
                {item.txHash && (
                  <div className="mt-2 pt-2 border-t border-gray-200">
                    <a
                      href={`https://polygonscan.com/tx/${item.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline font-mono"
                    >
                      {item.txHash.slice(0, 10)}...{item.txHash.slice(-8)}
                    </a>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}