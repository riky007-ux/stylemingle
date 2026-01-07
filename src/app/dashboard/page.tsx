"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

const TOKEN_KEY = "authToken";

export default function DashboardPage() {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      router.replace("/login");
    }
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem(TOKEN_KEY);
    router.replace("/login");
  };

  return (
    <main>
      <h1>Dashboard</h1>
      <p>Welcome to your dashboard.</p>
      <button onClick={handleLogout}>Logout</button>
    </main>
  );
}
