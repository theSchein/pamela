'use client';

import { useState } from 'react';
import { useWalletBalance } from '@/hooks/useWallet';
import { usePortfolioStats } from '@/hooks/usePolymarket';
import { useDataApiPositions } from '@/hooks/useDataApiPositions';
import { PositionsTable } from './PositionsTable';
import { TradeHistoryV2 } from './TradeHistoryV2';
import { TelegramStatus } from './TelegramStatus';

interface DashboardProps {
  walletAddress: string;
}

export function Dashboard({ walletAddress }: DashboardProps) {
  const [activeTab, setActiveTab] = useState<'positions' | 'history'>('positions');
  const { data: balance, isLoading: balanceLoading, error: balanceError } = useWalletBalance(walletAddress);
  // Use Data API for positions - much faster and no extra market fetching needed
  const { data: dataApiPositions, isLoading: positionsLoading, error: positionsError } = useDataApiPositions(walletAddress);
  const { data: stats } = usePortfolioStats(dataApiPositions);
  
  // Filter for active positions (those with size > 0)
  const activePositions = dataApiPositions?.filter((pos: any) => parseFloat(pos.size) > 0.01) || [];

  if (balanceLoading || positionsLoading) {
    return (
      <div className="p-8">
        <div className="text-center text-2xl font-russo text-red-600 animate-pulse">
          LOADING...
        </div>
      </div>
    );
  }

  if (balanceError || positionsError) {
    return (
      <div className="p-8">
        <div className="text-red-600 text-xl font-russo bg-yellow-100 border-4 border-red-600 rounded-lg p-4">
          ⚠️ ERROR: {(balanceError || positionsError)?.toString()}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="lg:col-span-1">
          <TelegramStatus />
        </div>
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-lg shadow-xl border-4 border-red-500 p-6">
            <h2 className="text-3xl font-bebas text-red-600 mb-4 drop-shadow-md">WALLET SURVEILLANCE</h2>
        <div className="space-y-4">
          <div className="bg-red-50 border-2 border-red-400 rounded-lg p-3">
            <p className="text-red-700 font-russo uppercase text-sm mb-1">WALLET ADDRESS</p>
            <p className="font-mono text-red-600 text-lg font-bold break-all">
              {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
            </p>
            <p className="font-mono text-red-500 text-xs mt-1" title={walletAddress}>
              {walletAddress}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-yellow-50 border-2 border-yellow-400 rounded-lg p-3">
              <p className="text-red-700 font-russo uppercase text-sm">USDC BALANCE</p>
              <p className="text-3xl font-bebas text-red-600">${balance?.usdc || '0'}</p>
            </div>
            <div className="bg-yellow-50 border-2 border-yellow-400 rounded-lg p-3">
              <p className="text-red-700 font-russo uppercase text-sm">MATIC BALANCE</p>
              <p className="text-xl font-bebas text-red-600">{balance?.matic || '0'}</p>
            </div>
          </div>
        </div>
      </div>
        </div>
      </div>

      {stats && (
        <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-lg shadow-xl border-4 border-red-500 p-6 col-span-full">
          <h2 className="text-3xl font-bebas text-red-600 mb-4 drop-shadow-md">TRADING PERFORMANCE METRICS</h2>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-red-700 font-russo uppercase text-sm">Total Value</p>
              <p className="text-2xl font-bebas text-red-600">${stats.totalValue.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-red-700 font-russo uppercase text-sm">Unrealized P&L</p>
              <p className={`text-2xl font-bebas ${stats.pnl.unrealized >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                ${stats.pnl.unrealized.toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-red-700 font-russo uppercase text-sm">Realized P&L</p>
              <p className={`text-2xl font-bebas ${stats.pnl.realized >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                ${stats.pnl.realized.toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-red-700 font-russo uppercase text-sm">Active Positions</p>
              <p className="text-xl font-bebas text-red-600">{stats.activeCount}</p>
            </div>
            <div>
              <p className="text-red-700 font-russo uppercase text-sm">Resolved Positions</p>
              <p className="text-xl font-bebas text-red-600">{stats.resolvedCount}</p>
            </div>
            <div>
              <p className="text-red-700 font-russo uppercase text-sm">Total Positions</p>
              <p className="text-xl font-bebas text-red-600">{stats.positionCount}</p>
            </div>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="col-span-full">
        <div className="flex gap-4 mb-4">
          <button
            onClick={() => setActiveTab('positions')}
            className={`px-6 py-3 rounded-lg font-russo text-lg transition-all ${
              activeTab === 'positions'
                ? 'bg-red-600 text-yellow-100 shadow-lg scale-105'
                : 'bg-yellow-200 text-red-700 hover:bg-yellow-300'
            }`}
          >
            ACTIVE POSITIONS ({activePositions?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-6 py-3 rounded-lg font-russo text-lg transition-all ${
              activeTab === 'history'
                ? 'bg-red-600 text-yellow-100 shadow-lg scale-105'
                : 'bg-yellow-200 text-red-700 hover:bg-yellow-300'
            }`}
          >
            TRADE HISTORY
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'positions' ? (
          activePositions && activePositions.length > 0 ? (
            <PositionsTable positions={activePositions} title="ACTIVE POSITIONS" />
          ) : (
            <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-lg shadow-xl border-4 border-red-500 p-6">
              <p className="text-center text-xl font-russo text-red-600">No active positions</p>
            </div>
          )
        ) : (
          <TradeHistoryV2 walletAddress={walletAddress} />
        )}
      </div>
    </div>
  );
}