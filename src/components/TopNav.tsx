"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "../context/AuthContext";

export default function TopNav() {
  const { isAuthenticated, logout } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  return (
    <nav className="flex items-center justify-between px-6 py-4 border-b bg-white">
      <div className="text-xl font-bold">
        <Link href="/">StyleMingle</Link>
      </div>

      <div className="flex space-x-4 items-center">
        {isAuthenticated ? (
          <>
            <Link href="/dashboard">Dashboard</Link>
            <Link href="/dashboard/wardrobe">Wardrobe</Link>
            <Link href="/dashboard/outfits">Outfits</Link>
            <Link href="/dashboard/avatar">Avatar</Link>
            <Link href="/dashboard/avatar" className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-white text-xs">A</Link>
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
