import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Pamela Trading Monitor',
  description: 'Real-time monitoring for Pamela prediction market trading agent',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}