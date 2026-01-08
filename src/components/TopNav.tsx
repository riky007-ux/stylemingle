"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const TopNav = () => {
  const [loggedIn, setLoggedIn] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (typeof window !== "undefined") {
      const token = localStorage.getItem('authToken');
      setLoggedIn(!!token);
    }
  }, []);

  const handleLogout = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem('authToken');
      router.push('/login');
    }
  };

  return (
    <nav>
      <ul style={{ display: 'flex', gap: '1rem', listStyle: 'none', padding: 0 }}>
        <li><Link href="/">StyleMingle</Link></li>
        {!loggedIn ? (
          <>
            <li><Link href="/login">Login</Link></li>
            <li><Link href="/signup">Sign Up</Link></li>
            <li><Link href="/dashboard">Dashboard</Link></li>
          </>
        ) : (
          <>
            <li><Link href="/dashboard">Dashboard</Link></li>
            <li><Link href="/dashboard/wardrobe">Wardrobe</Link></li>
            <li><button onClick={handleLogout}>Logout</button></li>
          </>
        )}
      </ul>
    </nav>
  );
};

export default TopNav;
