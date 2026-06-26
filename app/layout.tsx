import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Nav from '@/components/Nav'
import OfflineBanner from '@/components/OfflineBanner'
import BottomNav from '@/components/BottomNav'
import Footer from '@/components/Footer'
import ServiceWorkerRegister from '@/components/ServiceWorkerRegister'
import Toaster from '@/components/Toaster'

const inter = Inter({ subsets: ['latin'] })

export const viewport: Viewport = {
  themeColor: '#7c6aff',
  viewportFit: 'cover',
}

export const metadata: Metadata = {
  title: 'Mikomi — Read Manga, Manhwa, Manhua',
  description: 'Read manga, manhwa, and manhua online for free. Discover the latest updates, popular series, and new arrivals.',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/icons/favicon-16.png', sizes: '16x16', type: 'image/png' },
      { url: '/icons/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/icon-96.png',    sizes: '96x96',  type: 'image/png' },
    ],
    apple: [
      { url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
    shortcut: '/favicon.ico',
  },
  openGraph: {
    title: 'Mikomi — Read Manga, Manhwa, Manhua',
    description: 'Read manga, manhwa, and manhua online for free.',
    type: 'website',
    siteName: 'Mikomi',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Mikomi — Read Manga, Manhwa, Manhua',
    description: 'Read manga, manhwa, and manhua online for free.',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Mikomi',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/icons/favicon-32.png" type="image/png" sizes="32x32" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
      </head>
      <body className={`${inter.className} bg-bg text-fg flex flex-col min-h-screen`}>
        <ServiceWorkerRegister />
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:px-4 focus:py-2 focus:rounded-lg focus:bg-accent focus:text-white focus:text-sm focus:font-medium"
        >
          Skip to content
        </a>
        <Nav />
        <OfflineBanner />
        <main id="main-content" className="flex-1 flex flex-col max-w-6xl w-full mx-auto px-4 py-6 pb-24 md:pb-6">{children}</main>
        <Footer />
        <BottomNav />
        <Toaster />
      </body>
    </html>
  )
}
