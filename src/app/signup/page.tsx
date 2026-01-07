'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const TOKEN_KEY = 'authToken';

export default function DashboardPage() {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      router.replace('/login');
    }
  }, [router]);

  return (
    <main className="p-4">
      <h1 className="text-2xl font-semibold mb-4">Dashboard</h1>
      <p className="mb-4">Welcome to your dashboard.</p>
      <Link href="/dashboard/wardrobe" className="inline-block px-4 py-2 bg-blue-500 text-white rounded">
        Add Item
      </Link>
    </main>
  );
}
