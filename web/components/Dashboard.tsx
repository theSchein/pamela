'use client';

import { useWalletBalance, useRecentTransactions } from '@/hooks/useWallet';
import { usePositions, usePortfolioStats } from '@/hooks/usePolymarket';
import { PositionsTable } from './PositionsTable';
import { TelegramMessages } from './TelegramMessages';

interface DashboardProps {
  walletAddress: string;
}

export function Dashboard({ walletAddress }: DashboardProps) {
  const { data: balance, isLoading: balanceLoading, error: balanceError } = useWalletBalance(walletAddress);
  const { data: positions, isLoading: positionsLoading, error: positionsError } = usePositions(walletAddress);
  const { data: stats } = usePortfolioStats(positions);
  const { data: transactions } = useRecentTransactions(walletAddress, 5);

  if (balanceLoading || positionsLoading) {
    return (
      <div className="p-8">
        <div className="text-center">Loading wallet data...</div>
      </div>
    );
  }

  if (balanceError || positionsError) {
    return (
      <div className="p-8">
        <div className="text-red-500">
          Error loading data: {(balanceError || positionsError)?.toString()}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="lg:col-span-1">
          <TelegramMessages />
        </div>
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-2xl font-bold mb-4">Wallet Overview</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-gray-600">Address</p>
            <p className="font-mono text-sm">{walletAddress}</p>
          </div>
          <div>
            <p className="text-gray-600">USDC Balance</p>
            <p className="text-2xl font-bold">${balance?.usdc || '0'}</p>
          </div>
          <div>
            <p className="text-gray-600">MATIC Balance</p>
            <p className="text-lg">{balance?.matic || '0'}</p>
          </div>
        </div>
      </div>
        </div>
      </div>

      {stats && (
        <div className="bg-white rounded-lg shadow p-6 col-span-full">
          <h2 className="text-2xl font-bold mb-4">Portfolio Statistics</h2>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-gray-600">Total Value</p>
              <p className="text-xl font-bold">${stats.totalValue.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-gray-600">Unrealized P&L</p>
              <p className={`text-xl font-bold ${stats.pnl.unrealized >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                ${stats.pnl.unrealized.toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-gray-600">Realized P&L</p>
              <p className={`text-xl font-bold ${stats.pnl.realized >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                ${stats.pnl.realized.toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-gray-600">Active Positions</p>
              <p className="text-lg">{stats.activeCount}</p>
            </div>
            <div>
              <p className="text-gray-600">Resolved Positions</p>
              <p className="text-lg">{stats.resolvedCount}</p>
            </div>
            <div>
              <p className="text-gray-600">Total Positions</p>
              <p className="text-lg">{stats.positionCount}</p>
            </div>
          </div>
        </div>
      )}

      {positions && positions.length > 0 && (
        <div className="col-span-full">
          <PositionsTable positions={positions} />
        </div>
      )}

      {transactions && transactions.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6 col-span-full">
          <h2 className="text-2xl font-bold mb-4">Recent Transactions</h2>
          <div className="space-y-2">
            {transactions.map((tx, index) => (
              <div key={index} className="flex justify-between text-sm">
                <div>
                  <p className="font-mono">{tx.hash.slice(0, 10)}...</p>
                  <p className="text-gray-600">Block #{tx.blockNumber}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold">${tx.amount} USDC</p>
                  <p className="text-gray-600">
                    {new Date(tx.timestamp * 1000).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}