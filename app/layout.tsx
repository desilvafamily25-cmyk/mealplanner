import './globals.css'
import Nav from '@/components/Nav'
import InstallPrompt from '@/components/InstallPrompt'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Meal Planner',
  description: 'Dinner, school lunch & shopping list planner',
  themeColor: '#4338ca'
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#4338ca" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      </head>
      <body>
        <Nav />
        <main className="container py-6">{children}</main>
        <InstallPrompt />
      </body>
    </html>
  )
}
