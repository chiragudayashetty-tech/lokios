import './globals.css'
import './design-overrides.css'
import './dashboard-overrides.css'
import './mobile-premium.css'
import './opal.css'
import './tailwind.css'
import { Inter, Plus_Jakarta_Sans } from 'next/font/google'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' })
const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'], weight: ['500', '600', '700', '800'], variable: '--font-jakarta', display: 'swap' })

export const metadata = {
  title: 'ChiragOS',
  description: 'A private operating system for focus, execution, and discipline.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'ChiragOS',
  },
  icons: {
    icon: '/icons/icon-192.png',
    apple: '/icons/icon-192.png',
  },
}

export const viewport = {
  themeColor: '#050a14',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
}

import { OSProvider } from '@/lib/context/OSContext'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { PersistentShell } from '@/components/layout/AppShell'
import { ACTIVE_SEASON } from '@/lib/theme/levelTheme'

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${inter.variable} ${jakarta.variable}`} data-season={ACTIVE_SEASON || undefined}>
      <body>
        <ErrorBoundary>
          <OSProvider>
            <PersistentShell>{children}</PersistentShell>
          </OSProvider>
        </ErrorBoundary>
      </body>
    </html>
  )
}
