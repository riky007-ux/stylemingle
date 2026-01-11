import './globals.css'
import type { Metadata } from 'next'
import ClientProviders from './ClientProviders'

export const metadata: Metadata = {
  title: 'StyleMingle',
  description: 'StyleMingle Application',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ClientProviders>
          {children}
        </ClientProviders>
      </body>
    </html>
  )
}
