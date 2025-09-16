import { Dashboard } from '@/components/Dashboard'
import Image from 'next/image'

// Get wallet address from environment variable or use a default for testing
const WALLET_ADDRESS = process.env.NEXT_PUBLIC_AGENT_WALLET || '0x0000000000000000000000000000000000000000'

export default function Home() {
  return (
    <div className="min-h-screen">
      {/* Baywatch-style header */}
      <header className="bg-gradient-to-r from-red-600 via-red-500 to-orange-500 shadow-2xl border-b-4 border-yellow-400">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            {/* Title with Baywatch styling */}
            <div className="flex-1">
              <h1 className="text-6xl md:text-8xl font-bebas tracking-wider text-yellow-300 drop-shadow-[0_4px_8px_rgba(0,0,0,0.8)] animate-pulse">
                PAMELA WATCH
              </h1>
              <p className="text-xl md:text-2xl font-russo text-yellow-100 mt-2 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                FOLLOW PAMELA'S TRADES
              </p>
            </div>
            
            {/* Pamela image and description */}
            <div className="flex items-center space-x-4">
              <div className="text-right mr-4">
                <h2 className="text-2xl font-bebas text-yellow-300 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                  AGENT PAMELA
                </h2>
                <p className="text-sm text-yellow-100 max-w-xs">
                  An autonomous prediction market trading agent. See her communicate through telegram and follow here Polymarket positions below. 
                </p>
              </div>
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-yellow-400 to-red-400 rounded-full blur-xl opacity-70 animate-pulse"></div>
                <div className="relative w-32 h-32 md:w-40 md:h-40 rounded-full border-4 border-yellow-400 shadow-2xl overflow-hidden bg-white">
                  <Image
                    src="/pamela.png"
                    alt="Agent Pamela"
                    fill
                    sizes="(max-width: 768px) 128px, 160px"
                    className="object-cover object-center"
                    priority
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>
      
      {/* Dashboard content */}
      <main className="container mx-auto px-4 py-8">
        <Dashboard walletAddress={WALLET_ADDRESS} />
      </main>
    </div>
  )
}