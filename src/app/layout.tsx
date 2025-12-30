import './globals.css';
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'StyleMingle',
  description: 'AI-powered personal styling app',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col">
        <header className="bg-white shadow">
          <nav className="container mx-auto px-4 py-4 flex justify-between items-center">
            <Link href="/" className="text-2xl font-bold">StyleMingle</Link>
            <ul className="flex space-x-4">
              <li><Link href="/login">Login</Link></li>
              <li><Link href="/signup">Sign Up</Link></li>
              <li><Link href="/dashboard">Dashboard</Link></li>
            </ul>
          </nav>
        </header>
        <main className="flex-1 container mx-auto px-4 py-8">
          {children}
        </main>
      </body>
    </html>
  );
}
