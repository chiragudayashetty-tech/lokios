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
}

import { OSProvider } from '@/lib/context/OSContext'
import ParticlesBackground from '@/components/ui/ParticlesBackground'

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <ParticlesBackground />
        <OSProvider>
          {children}
        </OSProvider>
      </body>
    </html>
  )
}
