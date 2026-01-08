"use client";
import Link from 'next/link';
import { useState, useEffect } from 'react';

const TopNav = () => {
  const [token, setToken] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    const storedToken = localStorage.getItem("authToken");
    setToken(storedToken);
    setIsMounted(true);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("authToken");
    window.location.href = "/login";
  };

  if (!isMounted) {
    return (
      <nav className="flex justify-between items-center p-4 border-b">
        <Link href="/">StyleMingle</Link>
        <Link href="/dashboard">Dashboard</Link>
      </nav>
    );
  }

  return (
    <nav className="flex justify-between items-center p-4 border-b">
      <Link href="/">StyleMingle</Link>
      <div className="space-x-4">
        {token ? (
          <>
            <Link href="/dashboard">Dashboard</Link>
            <Link href="/dashboard/wardrobe">Wardrobe</Link>
            <button onClick={handleLogout}>Logout</button>
          </>
        ) : (
          <>
            <Link href="/login">Login</Link>
            <Link href="/signup">Sign Up</Link>
            <Link href="/dashboard">Dashboard</Link>
          </>
        )}
      </div>
    </nav>
  );
};

export default TopNav;
