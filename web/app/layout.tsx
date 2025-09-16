import type { Metadata } from 'next'
import './globals.css'
import { Providers } from '@/components/providers'

export const metadata: Metadata = {
  title: 'PAMELA WATCH',
  description: 'Real-time monitoring for Pamela - Autonomous Agent',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Anton&family=Russo+One&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-gradient-to-br from-yellow-100 via-orange-50 to-yellow-50">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}