'use client';

import './globals.css';
import type { Metadata } from 'next';
import TopNav from '../components/TopNav';
import { AuthProvider } from '../context/AuthContext';

export const metadata: Metadata = {
  title: 'StyleMingle',
  description: 'StyleMingle Application',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <TopNav />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
