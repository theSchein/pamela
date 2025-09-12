import { Dashboard } from '@/components/Dashboard'

// Get wallet address from environment variable or use a default for testing
const WALLET_ADDRESS = process.env.NEXT_PUBLIC_AGENT_WALLET || '0x0000000000000000000000000000000000000000'

export default function Home() {
  return <Dashboard walletAddress={WALLET_ADDRESS} />
}