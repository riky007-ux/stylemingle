import './globals.css';
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'StyleMingle',
  description: 'AI-powered personal styling app',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-screen bg-primary-bg text-deep-espresso font-sans">
        <header className="border-b border-warm-taupe bg-secondary-bg shadow-soft">
          <nav className="container mx-auto flex items-center justify-between py-m px-l">
            <div className="text-xl font-bold">
              <Link href="/">StyleMingle</Link>
            </div>
            <ul className="flex space-x-m">
              <li>
                <Link href="/login">Login</Link>
              </li>
              <li>
                <Link href="/signup">Signup</Link>
              </li>
              <li>
                <Link href="/dashboard">Dashboard</Link>
              </li>
            </ul>
          </nav>
        </header>
        <main className="container mx-auto py-l px-l">{children}</main>
      </body>
    </html>
  );
}
