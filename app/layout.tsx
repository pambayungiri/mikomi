import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Mikomi — Read Manga, Manhwa, Manhua',
  description: 'Read manga, manhwa, and manhua online.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-bg text-fg min-h-screen`}>
        <Nav />
        <main className="max-w-6xl mx-auto px-4 py-6">{children}</main>
        <Footer />
      </body>
    </html>
  )
}
