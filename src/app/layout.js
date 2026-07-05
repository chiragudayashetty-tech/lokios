import './globals.css'
import './design-overrides.css'
import './dashboard-overrides.css'

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
  themeColor: '#0b0d12',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  interactiveWidget: 'resizes-content',
}

import { OSProvider } from '@/lib/context/OSContext'
import ParticlesWrapper from '@/components/ui/ParticlesWrapper'
import { ErrorBoundary } from '@/components/ErrorBoundary'

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <ErrorBoundary>
          <ParticlesWrapper />
          <OSProvider>
            {children}
          </OSProvider>
        </ErrorBoundary>
      </body>
    </html>
  )
}
