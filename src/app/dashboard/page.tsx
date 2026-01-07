'use client'

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

  const handleLogout = () => {
    localStorage.removeItem(TOKEN_KEY);
    router.replace('/login');
  };

  return (
    <main className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <button
          onClick={handleLogout}
          className="px-4 py-2 bg-red-500 text-white rounded"
        >
          Logout
        </button>
      </div>
      <p className="mb-4">Welcome to your dashboard.</p>
      <Link href="/dashboard/wardrobe" className="inline-block px-4 py-2 bg-blue-500 text-white rounded">
        Add Item
      </Link>
    </main>
  );
}
