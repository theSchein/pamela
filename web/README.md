# Pamela Web Monitor

Real-time monitoring dashboard for the Pamela autonomous trading agent.

## Directory Structure

```
web/
├── app/                    # Next.js App Router
│   ├── api/               # API routes for data fetching
│   ├── layout.tsx         # Root layout
│   ├── page.tsx          # Main dashboard page
│   └── globals.css       # Global styles
│
├── components/            # React components
│   ├── Dashboard.tsx     # Main dashboard component
│   ├── PositionsTable.tsx # Active positions display
│   ├── TradeHistoryV2.tsx # Trade history table
│   ├── TelegramStatus.tsx # Telegram bot status display
│   ├── TelegramMetrics.tsx # Telegram performance metrics
│   ├── ui/               # shadcn/ui components
│   ├── dashboard/        # Dashboard cards
│   ├── wallet/           # Wallet components
│   ├── positions/        # Position cards
│   ├── charts/           # Data visualizations
│   └── layout/           # Layout components
│
├── lib/                   # Core functionality
│   ├── services/         # API clients & data fetching
│   │   ├── polymarket.ts    # Polymarket CLOB API
│   │   ├── blockchain.ts    # ethers.js integration
│   │   └── agent.ts         # Agent API client
│   ├── telegram-polling.ts  # Telegram message polling
│   ├── telegram-service.ts  # Telegram API integration
│   ├── telegram-store.ts    # Telegram state management
│   ├── hooks/            # Custom React hooks
│   ├── types/            # TypeScript definitions
│   ├── constants/        # App constants
│   └── utils/            # Utility functions
│
└── public/               # Static assets
    ├── favicon.ico
    └── pamela.png       # Logo
```

## Features

- **Real-time Monitoring**: Live updates of wallet balance, positions, and P&L
- **Position Tracking**: Active positions with current prices and performance
- **Performance Metrics**: Win rate, total P&L, and other key metrics
- **Agent Activity Feed**: Real-time messages from the trading agent
- **Transaction History**: Recent deposits, trades, and redemptions

## Development

```bash
# Start development server
npm run dev:web

# Build for production
npm run build:web

# Start production server
npm run start:web
```

## Environment Variables

Copy `.env.local.example` to `.env.local` and configure:

```env
NEXT_PUBLIC_AGENT_WALLET=0x...          # Agent wallet address
NEXT_PUBLIC_CLOB_URL=https://clob.polymarket.com
NEXT_PUBLIC_RPC_URL=https://polygon-rpc.com
NEXT_PUBLIC_AGENT_API=http://localhost:3000/api
NEXT_PUBLIC_REFRESH_INTERVAL=10000
```

## Tech Stack

- **Next.js 15**: React framework with App Router
- **TypeScript**: Type safety
- **Tailwind CSS**: Styling
- **React Query**: Data fetching & caching
- **ethers.js**: Blockchain interaction
- **Recharts**: Charts and visualizations