'use client'

import { useEffect, useState } from 'react'

export default function Dashboard() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return null
  }

  return (
    <div className="min-h-screen p-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Pamela Trading Monitor</h1>
        <p className="text-gray-400">Real-time monitoring dashboard for autonomous prediction market trading</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Wallet Balance */}
        <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
          <h2 className="text-lg font-semibold mb-4">Wallet Balance</h2>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-400">USDC</span>
              <span className="font-mono">$0.00</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">ETH</span>
              <span className="font-mono">0.00</span>
            </div>
          </div>
        </div>

        {/* Active Positions */}
        <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
          <h2 className="text-lg font-semibold mb-4">Active Positions</h2>
          <div className="text-center text-gray-400 py-4">
            No active positions
          </div>
        </div>

        {/* Performance */}
        <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
          <h2 className="text-lg font-semibold mb-4">Performance</h2>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-400">Total P&L</span>
              <span className="font-mono">$0.00</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Win Rate</span>
              <span className="font-mono">0%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="mt-8 bg-gray-900 rounded-lg p-6 border border-gray-800">
        <h2 className="text-lg font-semibold mb-4">Recent Agent Activity</h2>
        <div className="text-center text-gray-400 py-8">
          Waiting for agent messages...
        </div>
      </div>
    </div>
  )
}