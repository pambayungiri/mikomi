import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Nav from '@/components/Nav'
import BottomNav from '@/components/BottomNav'
import Footer from '@/components/Footer'
import ServiceWorkerRegister from '@/components/ServiceWorkerRegister'

const inter = Inter({ subsets: ['latin'] })

export const viewport: Viewport = {
  themeColor: '#7c6aff',
  viewportFit: 'cover',
}

export const metadata: Metadata = {
  title: 'Mikomi — Read Manga, Manhwa, Manhua',
  description: 'Read manga, manhwa, and manhua online for free. Discover the latest updates, popular series, and new arrivals.',
  manifest: '/manifest.json',
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
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body className={`${inter.className} bg-bg text-fg min-h-screen`}>
        <ServiceWorkerRegister />
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:px-4 focus:py-2 focus:rounded-lg focus:bg-accent focus:text-white focus:text-sm focus:font-medium"
        >
          Skip to content
        </a>
        <Nav />
        <main id="main-content" className="max-w-6xl mx-auto px-4 py-6 pb-24 md:pb-6">{children}</main>
        <Footer />
        <BottomNav />
      </body>
    </html>
  )
}
