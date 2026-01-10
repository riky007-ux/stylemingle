'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../context/AuthContext';

export default function TopNav() {
  const { isAuthenticated, login, logout } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <nav className="flex items-center justify-between p-4 shadow-md">
      <div className="text-xl font-bold">
        <Link href="/">StyleMingle</Link>
      </div>
      <div className="flex space-x-4">
        {isAuthenticated ? (
          <>
            <Link href="/dashboard">Dashboard</Link>
            <Link href="/wardrobe">Wardrobe</Link>
            <button onClick={handleLogout}>Logout</button>
          </>
        ) : (
          <>
            <Link href="/login">Login</Link>
            <Link href="/signup">Sign Up</Link>
          </>
        )}
      </div>
    </nav>
  );
}
